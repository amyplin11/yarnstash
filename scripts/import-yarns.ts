import { config } from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local
config({ path: path.resolve(__dirname, '..', '.env.local') })

// ─── Configuration ───────────────────────────────────────────

const CONFIG = {
  RAVELRY_BASE_URL: 'https://api.ravelry.com',
  SEARCH_PAGE_SIZE: 50,
  DETAIL_BATCH_SIZE: 10,
  DELAY_BETWEEN_SEARCHES_MS: 500,
  DELAY_BETWEEN_DETAILS_MS: 300,
  DELAY_BETWEEN_BATCHES_MS: 2000,
  RETRY_DELAY_MS: 5000,
  MAX_RETRIES: 3,
  PROGRESS_FILE: path.resolve(__dirname, '.import-progress.json'),
}

// Ravelry weight filter values for search segmentation
const WEIGHT_CATEGORIES = [
  'thread',
  'cobweb',
  'lace',
  'light-fingering',
  'fingering',
  'sport',
  'dk',
  'worsted',
  'aran',
  'bulky',
  'super-bulky',
  'jumbo',
]

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

function getRavelryAuth(): string {
  const username = process.env.RAVELRY_USERNAME
  const password = process.env.RAVELRY_PASSWORD

  if (!username || !password) {
    throw new Error('Missing RAVELRY_USERNAME or RAVELRY_PASSWORD in .env.local')
  }

  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

// ─── Ravelry API ─────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  authHeader: string,
  retries = CONFIG.MAX_RETRIES
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    })

    if (response.ok) {
      return response.json()
    }

    if (response.status === 429) {
      const waitTime = CONFIG.RETRY_DELAY_MS * attempt
      console.warn(`  Rate limited (429). Waiting ${waitTime}ms before retry ${attempt}/${retries}...`)
      await sleep(waitTime)
      continue
    }

    if (response.status === 404) {
      return null
    }

    if (attempt === retries) {
      throw new Error(`Ravelry API error: ${response.status} ${response.statusText}`)
    }

    console.warn(`  Request failed (${response.status}). Retry ${attempt}/${retries}...`)
    await sleep(CONFIG.RETRY_DELAY_MS)
  }
}

interface SearchResult {
  yarns: any[]
  paginator: {
    page: number
    page_size: number
    results: number
    last_page: number
  }
}

async function searchYarns(
  authHeader: string,
  weight: string,
  page: number
): Promise<SearchResult> {
  const url = new URL(`${CONFIG.RAVELRY_BASE_URL}/yarns/search.json`)
  url.searchParams.set('weight', weight)
  url.searchParams.set('page', page.toString())
  url.searchParams.set('page_size', CONFIG.SEARCH_PAGE_SIZE.toString())
  url.searchParams.set('sort', 'best')

  const data = await fetchWithRetry(url.toString(), authHeader)
  return data
}

async function fetchYarnDetail(
  authHeader: string,
  yarnId: number
): Promise<any | null> {
  const url = `${CONFIG.RAVELRY_BASE_URL}/yarns/${yarnId}.json`
  const data = await fetchWithRetry(url, authHeader)
  return data?.yarn ?? null
}

// ─── Database Operations ─────────────────────────────────────

async function yarnExists(
  supabase: SupabaseClient,
  ravelryId: number
): Promise<boolean> {
  const { data } = await supabase
    .from('yarns')
    .select('ravelry_id')
    .eq('ravelry_id', ravelryId)
    .single()

  return data !== null
}

function buildFiberContentString(fibers: any[]): string {
  if (!fibers || fibers.length === 0) return ''
  return fibers
    .map((f: any) => {
      const name = f.fiber_type?.name || 'Unknown'
      const pct = f.percentage
      return pct ? `${pct}% ${name}` : name
    })
    .join(', ')
}

function extractStructuredFields(raw: any) {
  return {
    ravelry_id: raw.id,
    name: raw.name || 'Unknown',
    permalink: raw.permalink || null,

    yarn_company_name: raw.yarn_company?.name || raw.yarn_company_name || null,
    yarn_company_id: raw.yarn_company?.id || null,

    yarn_weight_id: raw.yarn_weight?.id || null,
    yarn_weight_name: raw.yarn_weight?.name || null,
    yarn_weight_ply: raw.yarn_weight?.ply?.toString() || null,
    yarn_weight_knit_gauge: raw.yarn_weight?.knit_gauge || null,
    yarn_weight_crochet_gauge: raw.yarn_weight?.crochet_gauge || null,
    yarn_weight_wpi: raw.yarn_weight?.wpi || null,

    grams: raw.grams || null,
    yardage: raw.yardage || null,
    wpi: raw.wpi || null,
    thread_size: raw.thread_size || null,
    texture: raw.texture || null,

    gauge_divisor: raw.gauge_divisor || null,
    min_gauge: raw.min_gauge || null,
    max_gauge: raw.max_gauge || null,

    min_needle_size_us: raw.min_needle_size?.us || null,
    max_needle_size_us: raw.max_needle_size?.us || null,
    min_needle_size_metric: raw.min_needle_size?.metric || null,
    max_needle_size_metric: raw.max_needle_size?.metric || null,
    min_hook_size_us: raw.min_hook_size?.us || null,
    max_hook_size_us: raw.max_hook_size?.us || null,
    min_hook_size_metric: raw.min_hook_size?.metric || null,
    max_hook_size_metric: raw.max_hook_size?.metric || null,

    discontinued: raw.discontinued ?? false,
    machine_washable: raw.machine_washable ?? null,

    rating_average: raw.rating_average || null,
    rating_count: raw.rating_count ?? 0,
    rating_total: raw.rating_total ?? 0,

    notes_html: raw.notes_html || raw.notes || null,

    fiber_content: buildFiberContentString(raw.yarn_fibers),
    first_photo_url:
      raw.photos?.[0]?.small_url ||
      raw.first_photo?.small_url ||
      null,

    raw_data: raw,
  }
}

async function upsertYarn(supabase: SupabaseClient, rawYarn: any): Promise<void> {
  const fields = extractStructuredFields(rawYarn)

  // Upsert main yarn record
  const { error: yarnError } = await supabase
    .from('yarns')
    .upsert(fields, { onConflict: 'ravelry_id' })

  if (yarnError) {
    throw new Error(`Failed to upsert yarn ${fields.ravelry_id}: ${yarnError.message}`)
  }

  // Replace fibers
  await supabase
    .from('yarn_fibers')
    .delete()
    .eq('yarn_ravelry_id', fields.ravelry_id)

  const fibers = rawYarn.yarn_fibers || []
  if (fibers.length > 0) {
    const fiberRows = fibers.map((f: any) => ({
      yarn_ravelry_id: fields.ravelry_id,
      fiber_type_id: f.fiber_type?.id || null,
      fiber_type_name: f.fiber_type?.name || null,
      percentage: f.percentage || null,
    }))

    const { error: fiberError } = await supabase
      .from('yarn_fibers')
      .insert(fiberRows)

    if (fiberError) {
      console.warn(`  Warning: Failed to insert fibers for yarn ${fields.ravelry_id}: ${fiberError.message}`)
    }
  }

  // Replace photos
  await supabase
    .from('yarn_photos')
    .delete()
    .eq('yarn_ravelry_id', fields.ravelry_id)

  const photos = rawYarn.photos || []
  if (photos.length > 0) {
    const photoRows = photos.map((p: any, i: number) => ({
      yarn_ravelry_id: fields.ravelry_id,
      ravelry_photo_id: p.id || null,
      sort_order: i,
      square_url: p.square_url || null,
      small_url: p.small_url || null,
      small2_url: p.small2_url || null,
      medium_url: p.medium_url || null,
      medium2_url: p.medium2_url || null,
      shelved_url: p.shelved_url || null,
    }))

    const { error: photoError } = await supabase
      .from('yarn_photos')
      .insert(photoRows)

    if (photoError) {
      console.warn(`  Warning: Failed to insert photos for yarn ${fields.ravelry_id}: ${photoError.message}`)
    }
  }
}

// ─── Progress Tracking ───────────────────────────────────────

interface ImportProgress {
  currentWeightIndex: number
  currentPage: number
  totalYarnsImported: number
  totalYarnsSkipped: number
  completedWeights: string[]
}

function loadProgress(): ImportProgress {
  try {
    const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      currentWeightIndex: 0,
      currentPage: 1,
      totalYarnsImported: 0,
      totalYarnsSkipped: 0,
      completedWeights: [],
    }
  }
}

function saveProgress(progress: ImportProgress): void {
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ─── Utility ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const shouldResume = process.argv.includes('--resume')

  console.log('=== Ravelry Yarn Import ===')
  console.log()

  const supabase = createSupabaseAdmin()
  const authHeader = getRavelryAuth()

  let progress: ImportProgress = shouldResume
    ? loadProgress()
    : {
        currentWeightIndex: 0,
        currentPage: 1,
        totalYarnsImported: 0,
        totalYarnsSkipped: 0,
        completedWeights: [],
      }

  if (shouldResume) {
    console.log(`Resuming from weight index ${progress.currentWeightIndex}, page ${progress.currentPage}`)
    console.log(`Previously imported: ${progress.totalYarnsImported}, skipped: ${progress.totalYarnsSkipped}`)
  }

  console.log(`Weight categories to process: ${WEIGHT_CATEGORIES.length}`)
  console.log()

  for (let wi = progress.currentWeightIndex; wi < WEIGHT_CATEGORIES.length; wi++) {
    const weight = WEIGHT_CATEGORIES[wi]
    const startPage = wi === progress.currentWeightIndex ? progress.currentPage : 1

    console.log(`\n--- Weight: ${weight} (starting at page ${startPage}) ---`)

    for (let page = startPage; ; page++) {
      let searchResult: SearchResult

      try {
        searchResult = await searchYarns(authHeader, weight, page)
      } catch (err) {
        console.error(`  Error searching page ${page} for ${weight}:`, err)
        // Save progress and continue to next weight
        break
      }

      if (!searchResult.yarns || searchResult.yarns.length === 0) {
        console.log(`  No more results for ${weight} at page ${page}`)
        break
      }

      const lastPage = searchResult.paginator.last_page
      console.log(`  Page ${page}/${lastPage} (${searchResult.yarns.length} yarns, ${searchResult.paginator.results} total)`)

      // Process yarns in batches
      const yarnIds: number[] = searchResult.yarns.map((y: any) => y.id)

      for (let i = 0; i < yarnIds.length; i += CONFIG.DETAIL_BATCH_SIZE) {
        const batch = yarnIds.slice(i, i + CONFIG.DETAIL_BATCH_SIZE)

        for (const yarnId of batch) {
          // Skip if already in database
          const exists = await yarnExists(supabase, yarnId)
          if (exists) {
            progress.totalYarnsSkipped++
            continue
          }

          try {
            const detail = await fetchYarnDetail(authHeader, yarnId)
            if (detail) {
              await upsertYarn(supabase, detail)
              progress.totalYarnsImported++

              if (progress.totalYarnsImported % 100 === 0) {
                console.log(`    Imported ${progress.totalYarnsImported} yarns so far...`)
              }
            }
            await sleep(CONFIG.DELAY_BETWEEN_DETAILS_MS)
          } catch (err) {
            console.error(`    Error importing yarn ${yarnId}:`, err)
          }
        }

        await sleep(CONFIG.DELAY_BETWEEN_BATCHES_MS)
      }

      // Save progress after each page
      progress.currentWeightIndex = wi
      progress.currentPage = page + 1
      saveProgress(progress)

      await sleep(CONFIG.DELAY_BETWEEN_SEARCHES_MS)

      if (page >= lastPage) break
    }

    progress.completedWeights.push(weight)
    progress.currentPage = 1
    saveProgress(progress)

    console.log(`  Completed weight: ${weight}`)
  }

  console.log()
  console.log('=== Import Complete ===')
  console.log(`Total imported: ${progress.totalYarnsImported}`)
  console.log(`Total skipped (already existed): ${progress.totalYarnsSkipped}`)

  // Clean up progress file on successful completion
  try {
    fs.unlinkSync(CONFIG.PROGRESS_FILE)
    console.log('Progress file cleaned up.')
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
