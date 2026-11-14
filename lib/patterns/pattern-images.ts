import type { SupabaseClient } from '@supabase/supabase-js'
import { extractPdfImages, type PdfImage } from './pdf-images'

/**
 * Images pulled out of a pattern PDF live beside it in the `pattern-pdfs`
 * bucket, under `<userId>/pattern-images/<patternId>/`, with a manifest.json
 * describing them. No table is involved: the manifest's presence is what marks
 * a pattern as already processed — including when it found zero images, so a
 * text-only PDF isn't re-scanned on every view.
 */
const BUCKET = 'pattern-pdfs'
const MANIFEST = 'manifest.json'

// Signed URLs are handed to the browser on page load; an hour comfortably
// covers a viewing session without leaving long-lived links around.
const SIGNED_URL_TTL_SECONDS = 60 * 60

export interface PatternImageEntry {
  file: string
  page: number
  width: number
  height: number
}

interface Manifest {
  version: 1
  extracted_at: string
  images: PatternImageEntry[]
}

export interface PatternImage extends Omit<PatternImageEntry, 'file'> {
  url: string
}

function imagesPrefix(userId: string, patternId: string) {
  return `${userId}/pattern-images/${patternId}`
}

/**
 * `patterns.pdf_url` holds a full public URL, not the storage key: everything
 * from `<userId>/` on is the key, passed through `encodeURI` by
 * `getPublicUrl`. Undo that, or a file named "Lakes Pullover.pdf" is looked
 * up as "Lakes%20Pullover.pdf" and never found.
 */
export function pdfStoragePath(pdfUrl: string, userId: string): string {
  return `${userId}/${decodeURI(pdfUrl.split(`${userId}/`).pop() ?? '')}`
}

async function readManifest(
  supabase: SupabaseClient,
  userId: string,
  patternId: string
): Promise<Manifest | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${imagesPrefix(userId, patternId)}/${MANIFEST}`)
  if (error || !data) return null
  try {
    return JSON.parse(await data.text()) as Manifest
  } catch {
    return null
  }
}

/**
 * Stores already-extracted images for a pattern. Overwrites any previous run,
 * so it is safe to call twice.
 *
 * `supabase` must be able to write under the user's folder — callers pass the
 * service-role client, having already established the pattern is the user's.
 */
export async function storePatternImages(
  supabase: SupabaseClient,
  userId: string,
  patternId: string,
  extracted: PdfImage[]
): Promise<PatternImageEntry[]> {
  const prefix = imagesPrefix(userId, patternId)

  const entries = await Promise.all(
    extracted.map(async (img, i) => {
      const file = `p${String(img.page).padStart(3, '0')}-${String(i).padStart(2, '0')}.webp`
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${prefix}/${file}`, img.data, { contentType: 'image/webp', upsert: true })
      if (error) throw new Error(`Failed to store image ${file}: ${error.message}`)
      return { file, page: img.page, width: img.width, height: img.height }
    })
  )

  // Written last: a manifest only exists once every image it lists does.
  const manifest: Manifest = { version: 1, extracted_at: new Date().toISOString(), images: entries }
  const { error: manifestError } = await supabase.storage
    .from(BUCKET)
    .upload(`${prefix}/${MANIFEST}`, JSON.stringify(manifest), {
      contentType: 'application/json',
      upsert: true,
    })
  if (manifestError) throw new Error(`Failed to store image manifest: ${manifestError.message}`)

  return entries
}

async function extractAndStore(
  supabase: SupabaseClient,
  userId: string,
  patternId: string,
  pdfPath: string
): Promise<PatternImageEntry[]> {
  const { data: pdf, error } = await supabase.storage.from(BUCKET).download(pdfPath)
  if (error || !pdf) {
    throw new Error(`Failed to read PDF for image extraction: ${error?.message ?? 'not found'}`)
  }
  const images = await extractPdfImages(new Uint8Array(await pdf.arrayBuffer()))
  return storePatternImages(supabase, userId, patternId, images)
}

/**
 * Returns the pattern's images with short-lived signed URLs, extracting them
 * first if this pattern has never been processed (patterns uploaded before
 * image extraction existed).
 */
export async function getPatternImages(
  supabase: SupabaseClient,
  userId: string,
  patternId: string,
  pdfPath: string
): Promise<PatternImage[]> {
  const manifest = await readManifest(supabase, userId, patternId)
  const entries = manifest?.images ?? (await extractAndStore(supabase, userId, patternId, pdfPath))
  if (entries.length === 0) return []

  const prefix = imagesPrefix(userId, patternId)
  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      entries.map((e) => `${prefix}/${e.file}`),
      SIGNED_URL_TTL_SECONDS
    )
  if (error || !signed) throw new Error(`Failed to sign image URLs: ${error?.message ?? 'unknown error'}`)

  return entries.flatMap((entry, i) => {
    const url = signed[i]?.signedUrl
    return url ? [{ url, page: entry.page, width: entry.width, height: entry.height }] : []
  })
}

/** Deletes every stored image (and the manifest) for a pattern. */
export async function removePatternImages(
  supabase: SupabaseClient,
  userId: string,
  patternId: string
): Promise<void> {
  const prefix = imagesPrefix(userId, patternId)
  const { data: files, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error || !files?.length) return
  await supabase.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`))
}
