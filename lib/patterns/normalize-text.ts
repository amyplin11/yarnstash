// Repairs typographic ligatures that come through a PDF's text layer.
//
// Designers' PDFs often draw "ff", "fi" and "fl" as single ligature glyphs.
// Claude reads the PDF's text layer, so those arrive either as the Unicode
// ligature characters (ﬁ, ﬂ), which don't match a search for "fi", or, when the
// font's ToUnicode map is broken, as some unrelated character. The Roomy Raglan
// PDF maps its "ff" glyph to Ư (U+01AF), so "bind off" was saved as "bind oƯ".

const LIGATURES: Record<string, string> = {
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'ﬅ': 'st',
  'ﬆ': 'st',
}

// Ư is a real Vietnamese letter, so only replace it touching a lowercase ASCII
// letter ("cuƯ", "oƯ"), where it can only be a broken "ff".
const MISMAPPED_FF = /(?<=[a-z])Ư|Ư(?=[a-z])/g

export function normalizeLigatures(text: string): string {
  return text
    .replace(/[ﬀ-ﬆ]/g, (ch) => LIGATURES[ch])
    .replace(MISMAPPED_FF, 'ff')
}

/** Applies normalizeLigatures to every string in a JSON-shaped value. */
export function normalizeLigaturesDeep<T>(value: T): T {
  if (typeof value === 'string') return normalizeLigatures(value) as T
  if (Array.isArray(value)) return value.map(normalizeLigaturesDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, normalizeLigaturesDeep(v)])
    ) as T
  }
  return value
}
