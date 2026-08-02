import type { CatalogYarn } from '@/lib/types'

/**
 * Matching a read-off-a-label brand and yarn name against the catalog. Shared
 * by the ball-band scan and the receipt import so both decide "is this the
 * same yarn?" the same way.
 */

/** Loose comparison so "Malabrigo!" and "malabrigo" count as the same brand. */
export function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Ball bands and receipts print the trading name, the catalog stores the
 * company name — "Malabrigo" on the label vs "Malabrigo Yarn" in the import.
 * Containment bridges that; the yarn name itself still has to match outright.
 */
export function brandMatches(a: string | null | undefined, b: string | null | undefined) {
  const x = normalize(a)
  const y = normalize(b)
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x))
}

/**
 * The single unambiguous hit, or null. Returning null on two equally good
 * candidates is deliberate: the user picks rather than silently getting the
 * wrong yarn.
 */
export function pickExactMatch(
  candidates: CatalogYarn[],
  brand: string,
  name: string
): CatalogYarn | null {
  const exact = candidates.filter(
    (yarn) =>
      brandMatches(yarn.yarn_company_name, brand) && normalize(yarn.name) === normalize(name)
  )
  return exact.length === 1 ? exact[0] : null
}

/** Catalog search shared by every flow that resolves a name to a catalog yarn. */
export async function searchCatalog(query: string, pageSize = 8): Promise<CatalogYarn[]> {
  if (!query.trim()) return []
  try {
    const response = await fetch(
      `/api/yarns?query=${encodeURIComponent(query)}&page_size=${pageSize}&sort=rating`
    )
    const data = await response.json()
    return response.ok ? data.yarns ?? [] : []
  } catch {
    return []
  }
}
