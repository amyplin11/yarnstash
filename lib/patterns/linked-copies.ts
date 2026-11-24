import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Other uploads of the same pattern in this user's library.
 *
 * A pattern extracted for one size is its own `patterns` row, so knitting a
 * second size means a second upload. Two rows are copies of one pattern when:
 *
 * - their PDFs have the same SHA-256 (`patterns.pdf_sha256`, set by the
 *   extraction worker) — the same file uploaded twice; or
 * - they have the same name and the same designer. This catches the common
 *   case where the bytes differ: shops stamp each download with the buyer and
 *   date, so a re-downloaded PDF hashes differently. A designer is required, so
 *   two unrelated "Basic Hat" patterns with no designer are not merged.
 *
 * A user's library is small, so this reads every pattern's identity columns
 * and compares in memory rather than building a PostgREST `or=` filter out of
 * free-text names (which would need escaping for commas and parentheses).
 */
export async function findLinkedCopies(
  supabase: SupabaseClient,
  userId: string,
  patternId: string
): Promise<{ id: string; name: string; selected_size: string | null }[]> {
  const { data, error } = await supabase
    .from('patterns')
    .select('id, name, designer, selected_size, pdf_sha256')
    .eq('user_id', userId)

  if (error || !data) {
    if (error) console.error('Error reading patterns for linked copies:', error)
    return []
  }

  const self = data.find((p) => p.id === patternId)
  if (!self) return []

  const norm = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const name = norm(self.name)
  const designer = norm(self.designer)

  return data
    .filter((p) => p.id !== patternId)
    .filter(
      (p) =>
        (self.pdf_sha256 && p.pdf_sha256 === self.pdf_sha256) ||
        (designer && name && norm(p.name) === name && norm(p.designer) === designer)
    )
    .map((p) => ({ id: p.id, name: p.name, selected_size: p.selected_size ?? null }))
}
