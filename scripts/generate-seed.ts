/**
 * Generates `supabase/seed.sql` — a small, representative slice of the global
 * yarn catalog for local development.
 *
 * The hosted catalog holds ~98k yarns, ~178k fiber rows and ~275k photo rows,
 * all of it imported from Ravelry over a slow, rate-limited run. Re-importing
 * that into a local database on every `db reset` is not viable, so this script
 * samples a fixed number of yarns per weight category and writes them out as
 * plain INSERT statements.
 *
 * Sampling is ordered by `ravelry_id`, so regenerating against an unchanged
 * catalog produces an identical file and the diff stays reviewable.
 *
 * Usage:
 *   npm run db:seed:generate                # 25 yarns per weight (~300 total)
 *   npm run db:seed:generate -- --per-weight=50
 */

import { config } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local — this reads from whichever project it points at, so run it
// against the hosted catalog, not a local stack you have not seeded yet.
config({ path: path.resolve(__dirname, '..', '.env.local') })

// ─── Configuration ───────────────────────────────────────────

const DEFAULT_PER_WEIGHT = 25

const OUTPUT_FILE = path.resolve(__dirname, '..', 'supabase', 'seed.sql')

// Display names as stored in `yarns.yarn_weight_name`. Sampling per weight
// keeps the weight filter on /yarns exercisable in dev — a naive `limit 300`
// would return 300 Fingering yarns and nothing else.
const WEIGHT_NAMES = [
  'Thread',
  'Cobweb',
  'Lace',
  'Light Fingering',
  'Fingering',
  'Sport',
  'DK',
  'Worsted',
  'Aran',
  'Bulky',
  'Super Bulky',
  'Jumbo',
]

// `search_vector` is maintained by the database, so it is omitted entirely and
// repopulated on insert.
//
// `raw_data` is the full Ravelry payload — never read by the app (see
// app/api/yarns/route.ts) and large enough to bloat the seed by an order of
// magnitude. It is kept in the column list but written as an empty object, so
// the seed still satisfies the column if it is NOT NULL.
const YARN_SKIP_COLUMNS = new Set(['search_vector'])

// Serial primary keys and timestamps are left to their column defaults, so the
// seed does not depend on sequence state.
const CHILD_SKIP_COLUMNS = new Set(['id', 'created_at'])

// Photo rows carry six near-duplicate CDN URLs each and dominate the file size
// — the full set for 300 yarns is ~850 KB on its own. Two per yarn keeps the
// detail-page gallery meaningful at a fraction of the size.
const PHOTOS_PER_YARN = 2

// ─── Clients ─────────────────────────────────────────────────

function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  return createClient(url, serviceKey)
}

// ─── SQL emission ────────────────────────────────────────────

/**
 * A row as returned by PostgREST. The column set is read off the live schema
 * rather than declared here, so that this script keeps working as the catalog
 * tables gain columns.
 */
type Row = Record<string, unknown>

/** Renders a JS value as a SQL literal. */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return `${quote(JSON.stringify(value))}::jsonb`
  return quote(String(value))
}

/** Single-quotes a string, doubling any embedded quotes. */
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`
}

/**
 * Builds a multi-row INSERT. Uses a bare `on conflict do nothing` rather than
 * naming a constraint, so the statement does not encode assumptions about the
 * schema's key names — which matter here, because the baseline migration that
 * defines these tables has not been captured yet.
 */
function buildInsert(table: string, rows: Row[], skip: Set<string>): string {
  if (rows.length === 0) return `-- ${table}: no rows sampled\n`

  const columns = Object.keys(rows[0]).filter((c) => !skip.has(c))
  const tuples = rows.map((row) => {
    const values = columns.map((c) => {
      // raw_data is deliberately emptied rather than copied; see above.
      if (table === 'yarns' && c === 'raw_data') return `'{}'::jsonb`
      return sqlLiteral(row[c])
    })
    return `  (${values.join(', ')})`
  })

  return (
    `insert into ${table} (${columns.join(', ')}) values\n` +
    `${tuples.join(',\n')}\n` +
    `on conflict do nothing;\n`
  )
}

// ─── Fetching ────────────────────────────────────────────────

async function sampleYarns(
  supabase: SupabaseClient,
  perWeight: number
): Promise<Row[]> {
  const sampled: Row[] = []

  for (const weight of WEIGHT_NAMES) {
    const { data, error } = await supabase
      .from('yarns')
      .select('*')
      .eq('yarn_weight_name', weight)
      .order('ravelry_id', { ascending: true })
      .limit(perWeight)

    if (error) {
      throw new Error(`Failed to sample "${weight}" yarns: ${error.message}`)
    }

    console.log(`  ${weight}: ${data?.length ?? 0}`)
    sampled.push(...(data ?? []))
  }

  return sampled
}

/**
 * Fetches child rows for the sampled yarns. `in` filters go into the URL, so
 * the id list is chunked to keep the request under PostgREST's URL limits.
 */
async function fetchChildRows(
  supabase: SupabaseClient,
  table: string,
  yarnIds: number[]
): Promise<Row[]> {
  const CHUNK_SIZE = 100
  const rows: Row[] = []

  for (let i = 0; i < yarnIds.length; i += CHUNK_SIZE) {
    const chunk = yarnIds.slice(i, i + CHUNK_SIZE)

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('yarn_ravelry_id', chunk)
      .order('id', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`)
    }

    rows.push(...(data ?? []))
  }

  return rows
}

/** Keeps at most `limit` rows per yarn, preserving the fetched order. */
function capPerYarn(rows: Row[], limit: number): Row[] {
  const counts = new Map<number, number>()

  return rows.filter((row) => {
    const yarnId = Number(row.yarn_ravelry_id)
    const seen = counts.get(yarnId) ?? 0
    if (seen >= limit) return false
    counts.set(yarnId, seen + 1)
    return true
  })
}

// ─── Main ────────────────────────────────────────────────────

function parsePerWeight(): number {
  const arg = process.argv.find((a) => a.startsWith('--per-weight='))
  if (!arg) return DEFAULT_PER_WEIGHT

  const parsed = Number(arg.split('=')[1])
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--per-weight must be a positive integer, got "${arg.split('=')[1]}"`)
  }

  return parsed
}

async function main() {
  const perWeight = parsePerWeight()
  const supabase = createSupabaseAdmin()

  console.log(`Sampling up to ${perWeight} yarns per weight category...`)
  const yarns = await sampleYarns(supabase, perWeight)

  const yarnIds = yarns.map((y) => Number(y.ravelry_id))
  console.log(`\nSampled ${yarns.length} yarns. Fetching fibers and photos...`)

  const fibers = await fetchChildRows(supabase, 'yarn_fibers', yarnIds)
  const allPhotos = await fetchChildRows(supabase, 'yarn_photos', yarnIds)
  const photos = capPerYarn(allPhotos, PHOTOS_PER_YARN)
  console.log(`  yarn_fibers: ${fibers.length}`)
  console.log(`  yarn_photos: ${photos.length} (capped from ${allPhotos.length})`)

  const header = [
    '-- Seed data for local development. GENERATED FILE — do not edit by hand.',
    '--',
    '-- Regenerate with:  npm run db:seed:generate',
    '--',
    `-- A ${yarns.length}-yarn slice of the global Ravelry catalog, sampled evenly across`,
    '-- weight categories so the weight filter and full-text search on /yarns have',
    '-- something to work against. `search_vector` is left to the database and',
    '-- `raw_data` is emptied — neither is read by the app. Photos are capped at',
    `-- ${PHOTOS_PER_YARN} per yarn to keep this file small.`,
    '--',
    '-- Applied automatically by `supabase db reset` (see [db.seed] in config.toml).',
    '-- Written to be re-runnable, but intended for a freshly reset database.',
    '',
  ].join('\n')

  const sql = [
    header,
    buildInsert('yarns', yarns, YARN_SKIP_COLUMNS),
    '',
    buildInsert('yarn_fibers', fibers, CHILD_SKIP_COLUMNS),
    '',
    buildInsert('yarn_photos', photos, CHILD_SKIP_COLUMNS),
  ].join('\n')

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8')

  const sizeKb = Math.round(Buffer.byteLength(sql, 'utf8') / 1024)
  console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_FILE)} (${sizeKb} KB)`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
