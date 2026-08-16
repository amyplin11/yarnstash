/**
 * Deletes pattern PDFs in the `pattern-pdfs` bucket that no row points at.
 *
 * The upload route writes the PDF to storage before extraction runs, and
 * nothing removes it when a user abandons the size-selection step, retries an
 * upload, or a job fails. Every one of those attempts leaves a full-size PDF
 * behind under the uploader's user-id prefix.
 *
 * Measured on 2026-08-16 against the hosted project: 28 stored objects, of
 * which 3 were referenced — one file had ten orphaned copies. That is ~33 MB
 * of the bucket's 37 MB. Storage is not what pushed this project over quota
 * (the yarn catalog did, see the catalog-bloat migration) but the leak grows
 * with every upload, so it is worth closing.
 *
 * An object is kept if it is referenced by either `patterns.pdf_url` or
 * `pattern_jobs.storage_path`. Jobs are included so an in-flight extraction is
 * never pulled out from under the worker.
 *
 * Usage:
 *   tsx scripts/prune-orphaned-pdfs.ts            # dry run — lists, deletes nothing
 *   tsx scripts/prune-orphaned-pdfs.ts --delete   # actually delete
 */

import { config } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import path from 'path'

config({ path: path.resolve(__dirname, '..', '.env.local') })

const BUCKET = 'pattern-pdfs'

// Objects newer than this are left alone even if unreferenced: an upload that
// is mid-flight right now has no row pointing at it yet, and deleting it would
// break a live extraction.
const MIN_AGE_HOURS = 24

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface StoredObject {
  path: string
  size: number
  createdAt: string | null
}

/**
 * Lists every object in the bucket. Storage list calls are per-prefix and do
 * not recurse, so the top level is read first (one folder per user id) and
 * each folder is then listed in turn.
 */
async function listAllObjects(supabase: SupabaseClient): Promise<StoredObject[]> {
  const { data: prefixes, error: prefixError } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 })

  if (prefixError) {
    throw new Error(`Failed to list bucket root: ${prefixError.message}`)
  }

  const objects: StoredObject[] = []

  for (const prefix of prefixes || []) {
    // Folders come back with no metadata; real files at the root would have it.
    if (prefix.metadata) {
      objects.push({
        path: prefix.name,
        size: prefix.metadata.size ?? 0,
        createdAt: prefix.created_at ?? null,
      })
      continue
    }

    const { data: files, error: fileError } = await supabase.storage
      .from(BUCKET)
      .list(prefix.name, { limit: 1000 })

    if (fileError) {
      console.warn(`  Warning: failed to list ${prefix.name}: ${fileError.message}`)
      continue
    }

    for (const file of files || []) {
      objects.push({
        path: `${prefix.name}/${file.name}`,
        size: file.metadata?.size ?? 0,
        createdAt: file.created_at ?? null,
      })
    }
  }

  return objects
}

/**
 * Every storage path still spoken for. `patterns.pdf_url` holds a public URL
 * rather than a bare path, so it is reduced to the trailing
 * `<user-id>/<file>` pair before comparing.
 */
async function collectReferencedPaths(supabase: SupabaseClient): Promise<Set<string>> {
  const referenced = new Set<string>()

  const { data: patterns, error: patternError } = await supabase
    .from('patterns')
    .select('pdf_url')

  if (patternError) {
    throw new Error(`Failed to read patterns: ${patternError.message}`)
  }

  for (const row of patterns || []) {
    if (!row.pdf_url) continue
    const segments = String(row.pdf_url).split('/').filter(Boolean)
    if (segments.length >= 2) {
      referenced.add(segments.slice(-2).join('/'))
    }
  }

  const { data: jobs, error: jobError } = await supabase
    .from('pattern_jobs')
    .select('storage_path')

  if (jobError) {
    throw new Error(`Failed to read pattern_jobs: ${jobError.message}`)
  }

  for (const row of jobs || []) {
    if (row.storage_path) referenced.add(String(row.storage_path))
  }

  return referenced
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function main() {
  const shouldDelete = process.argv.includes('--delete')
  const supabase = createAdminClient()

  console.log(`Scanning ${BUCKET}...`)

  const [objects, referenced] = await Promise.all([
    listAllObjects(supabase),
    collectReferencedPaths(supabase),
  ])

  const cutoff = Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000
  const orphans: StoredObject[] = []
  let skippedRecent = 0

  for (const object of objects) {
    if (referenced.has(object.path)) continue

    const createdMs = object.createdAt ? Date.parse(object.createdAt) : NaN
    if (Number.isFinite(createdMs) && createdMs > cutoff) {
      skippedRecent++
      continue
    }

    orphans.push(object)
  }

  const totalBytes = objects.reduce((sum, o) => sum + o.size, 0)
  const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0)

  console.log(`\n  stored objects:  ${objects.length} (${formatMb(totalBytes)})`)
  console.log(`  referenced:      ${objects.length - orphans.length - skippedRecent}`)
  if (skippedRecent > 0) {
    console.log(`  too recent:      ${skippedRecent} (younger than ${MIN_AGE_HOURS}h, left alone)`)
  }
  console.log(`  orphaned:        ${orphans.length} (${formatMb(orphanBytes)})`)

  if (orphans.length === 0) {
    console.log('\nNothing to prune.')
    return
  }

  console.log()
  for (const orphan of orphans) {
    console.log(`  ${formatMb(orphan.size).padStart(9)}  ${orphan.path}`)
  }

  if (!shouldDelete) {
    console.log(`\nDry run — nothing deleted. Re-run with --delete to remove these ${orphans.length} files.`)
    return
  }

  // Remove in batches; a single call with hundreds of paths can time out.
  const BATCH_SIZE = 50
  let deleted = 0

  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const batch = orphans.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.storage.from(BUCKET).remove(batch.map((o) => o.path))

    if (error) {
      console.error(`  Error deleting batch at ${i}: ${error.message}`)
      continue
    }

    deleted += batch.length
  }

  console.log(`\nDeleted ${deleted} of ${orphans.length} orphaned files (${formatMb(orphanBytes)}).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
