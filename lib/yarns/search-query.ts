/** Guard against a pathological paste turning into a huge tsquery. */
const MAX_TERMS = 6

/**
 * Build a prefix tsquery for type-ahead: `cascade 22` -> `cascade:* & 22:*`.
 *
 * The catalog's `search_vector` is the only fast way to search 98k yarns —
 * ILIKE with a leading wildcard was measured at ~7.5s, this at ~0.3s. But the
 * list endpoint's `websearch` mode only matches whole words, so "malab" finds
 * nothing until you finish typing "malabrigo". `to_tsquery` with `:*` gives the
 * prefix matching autocomplete needs.
 *
 * `to_tsquery` treats `& | ! : ( )` as syntax and errors on raw user input, so
 * terms are extracted rather than escaped. Returns null when nothing usable is
 * left (e.g. the user typed only punctuation).
 */
export function toPrefixTsQuery(input: string): string | null {
  const terms = input.toLowerCase().match(/[\p{L}\p{N}]+/gu)

  if (!terms || terms.length === 0) return null

  return terms
    .slice(0, MAX_TERMS)
    .map((term) => `${term}:*`)
    .join(' & ')
}
