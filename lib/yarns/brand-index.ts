import type { SupabaseClient } from '@supabase/supabase-js'
import type { YarnBrand } from '@/lib/types'

/**
 * The catalog has ~14,800 distinct brands spread over ~98,000 yarns, which is
 * far too many for a plain <select> and too many to ship to the browser.
 *
 * There is no `yarn_companies` table, PostgREST has no DISTINCT, and aggregate
 * functions are disabled on this project, so the only way to get the brand list
 * is to sweep the catalog and fold it down in memory. That sweep costs ~68
 * requests (PostgREST caps a response at 1000 rows), so the result is cached
 * per server instance instead of being rebuilt per keystroke.
 *
 * Filtering by brand with ILIKE was measured at ~2.2s because the leading
 * wildcard forces a sequential scan; exact matching against these names lets
 * `/api/yarns` use `.in()` instead, which lands in ~0.3s.
 */

const PAGE_SIZE = 1000
const CONCURRENT_PAGES = 12
const TTL_MS = 6 * 60 * 60 * 1000

interface CachedIndex {
  brands: YarnBrand[]
  builtAt: number
}

let cache: CachedIndex | null = null
let inFlight: Promise<YarnBrand[]> | null = null

/**
 * Counts cover non-discontinued yarns only, matching the `discontinued=false`
 * filter the yarns page always sends — so a brand listed as "42 yarns" really
 * does return 42 results when you pick it.
 */
async function buildBrandIndex(supabase: SupabaseClient): Promise<YarnBrand[]> {
  const { count, error: countError } = await supabase
    .from('yarns')
    .select('ravelry_id', { count: 'exact', head: true })
    .eq('discontinued', false)

  if (countError) {
    throw new Error(`Failed to count yarns: ${countError.message}`)
  }

  const offsets: number[] = []
  for (let offset = 0; offset < (count || 0); offset += PAGE_SIZE) {
    offsets.push(offset)
  }

  const counts = new Map<string, number>()

  for (let i = 0; i < offsets.length; i += CONCURRENT_PAGES) {
    const pages = await Promise.all(
      offsets.slice(i, i + CONCURRENT_PAGES).map(async (offset) => {
        const { data, error } = await supabase
          .from('yarns')
          .select('yarn_company_name')
          .eq('discontinued', false)
          .order('ravelry_id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) {
          throw new Error(`Failed to read yarns at offset ${offset}: ${error.message}`)
        }

        return (data || []) as { yarn_company_name: string | null }[]
      })
    )

    for (const rows of pages) {
      for (const row of rows) {
        const name = row.yarn_company_name?.trim()
        if (name) {
          counts.set(name, (counts.get(name) || 0) + 1)
        }
      }
    }
  }

  // An empty sweep means RLS rejected the reads (the catalog is only readable
  // by authenticated users). Throw rather than cache an empty list for 6 hours.
  if (counts.size === 0) {
    throw new Error('Brand index came back empty — the yarn catalog returned no rows')
  }

  // Sorted by popularity so every consumer can slice off the top and get the
  // brands a knitter is most likely to mean.
  return [...counts.entries()]
    .map(([name, brandCount]) => ({ name, count: brandCount }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Build the index if needed, sharing one build across concurrent callers. */
export async function getBrandIndex(supabase: SupabaseClient): Promise<YarnBrand[]> {
  if (cache && Date.now() - cache.builtAt < TTL_MS) {
    return cache.brands
  }

  if (!inFlight) {
    inFlight = buildBrandIndex(supabase)
      .then((brands) => {
        cache = { brands, builtAt: Date.now() }
        return brands
      })
      .finally(() => {
        inFlight = null
      })
  }

  return inFlight
}

/**
 * Return the index only if it is already warm. Autocomplete uses this so a
 * keystroke never waits on the multi-second sweep; brand suggestions simply
 * start appearing once the index has been built.
 */
export function peekBrandIndex(): YarnBrand[] | null {
  if (cache && Date.now() - cache.builtAt < TTL_MS) {
    return cache.brands
  }
  return null
}

/** Kick off a build without blocking the caller or surfacing failures. */
export function warmBrandIndex(supabase: SupabaseClient): void {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return

  void getBrandIndex(supabase).catch((error) => {
    console.error('Failed to warm yarn brand index:', error)
  })
}

/**
 * Rank a match by how it lines up with the query: an exact name, then a name
 * starting with it ("Wool Addicts", "Woolytoons"), then the query starting a
 * later word ("Cascade Wool"), then a hit buried mid-word ("Superwool").
 * Ties inside a tier are broken by popularity by the caller.
 * Returns -1 when the brand does not match at all.
 */
function matchTier(name: string, query: string): number {
  const lower = name.toLowerCase()

  if (lower === query) return 0
  if (lower.startsWith(query)) return 1

  const at = lower.indexOf(query)
  if (at < 0) return -1

  // A match starting a later word beats one buried mid-word.
  return /[^a-z0-9]/.test(lower[at - 1]) ? 2 : 3
}

export function searchBrands(brands: YarnBrand[], query: string, limit: number): YarnBrand[] {
  const normalized = query.trim().toLowerCase()

  // No query: the most popular brands are the most useful default.
  if (!normalized) return brands.slice(0, limit)

  const tiers: YarnBrand[][] = [[], [], [], []]

  for (const brand of brands) {
    const tier = matchTier(brand.name, normalized)
    if (tier >= 0) {
      tiers[tier].push(brand)
    }
  }

  // `brands` arrives sorted by count, so each tier is already popularity-ordered.
  return tiers.flat().slice(0, limit)
}

/** Exposed for tests / cache busting after a catalog import. */
export function resetBrandIndex(): void {
  cache = null
  inFlight = null
}
