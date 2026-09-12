const BUCKET_SEGMENT = '/pattern-pdfs/'

/**
 * Recovers a pattern PDF's path inside the `pattern-pdfs` bucket.
 *
 * `storage_path` is the source of truth. The `pdf_url` fallback covers rows
 * written before that column existed — it parses the legacy public URL shape
 * `.../object/public/pattern-pdfs/<user_id>/<ts>-<file>.pdf`.
 *
 * The delete route used to do this inline as
 * `pdf_url.split(`${user.id}/`).pop()`, which quietly produces the wrong path
 * if a filename happens to contain the user's uuid. Splitting on the bucket
 * segment instead has no such trap, and decoding matters because
 * `getPublicUrl()` percent-encodes spaces in filenames.
 */
export function storagePathForPattern(pattern: {
  storage_path?: string | null
  pdf_url?: string | null
}): string | null {
  if (pattern.storage_path) return pattern.storage_path
  if (!pattern.pdf_url) return null

  const index = pattern.pdf_url.indexOf(BUCKET_SEGMENT)
  if (index === -1) return null

  const encoded = pattern.pdf_url.slice(index + BUCKET_SEGMENT.length)
  if (!encoded) return null

  try {
    return decodeURIComponent(encoded)
  } catch {
    // Malformed escape sequence — better to use the raw value than to lose the
    // object entirely, since most paths contain nothing that needed encoding.
    return encoded
  }
}
