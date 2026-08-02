/**
 * Turns whatever the file picker hands us into a JPEG the Messages API accepts.
 *
 * Two things go wrong with photos taken on a phone:
 *
 *   - iPhones shoot HEIC by default, and the Anthropic API won't take it.
 *     Apple platforms can *decode* HEIC, so a canvas round-trip is enough in
 *     Safari; Chrome, Firefox and Android can't, and need a real decoder.
 *   - A 12MP photo is mostly wasted bytes when all we're reading is the few
 *     lines of text on a ball band.
 *
 * So: decode by whatever means works, then downscale and re-encode as JPEG.
 * The WASM decoder is ~3MB, so it is imported lazily and only once a native
 * decode has actually failed — an ordinary JPEG upload never downloads it.
 */

/** Longest edge sent to the API. Enough for label text without 12MP of noise. */
const MAX_EDGE = 2000

const JPEG_QUALITY = 0.85

/** Carries a message that is safe to show the user as-is. */
export class ImageConversionError extends Error {}

/**
 * ISO base media file format brands that mean "this is a HEIF image".
 * AVIF (`avif`/`avis`) shares the container but is not HEIC, and browsers that
 * can't decode it can't be helped by libheif either — so it is left out.
 */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

/**
 * Sniff the container rather than trusting the name or MIME type. Browsers
 * disagree about what to report for HEIC — Chrome on Windows often hands over
 * an empty `type`, and a file copied off a camera can land with any extension.
 * Only the first 12 bytes are read.
 */
export async function isHeic(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (header.length < 12) return false

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...header.subarray(start, end))

  // Bytes 4-8 are the box type, 8-12 the major brand.
  if (ascii(4, 8) !== 'ftyp') return false
  return HEIF_BRANDS.has(ascii(8, 12))
}

async function decodeHeic(file: File): Promise<ImageBitmap> {
  const { heicTo } = await import('heic-to')

  try {
    // Straight to a bitmap, skipping a full-size JPEG encode and re-decode —
    // that round-trip is the slow part on the phones that land here.
    return await heicTo({
      blob: file,
      type: 'bitmap',
      options: { imageOrientation: 'from-image' },
    })
  } catch {
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
    return await createImageBitmap(jpeg, { imageOrientation: 'from-image' })
  }
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Either the browser can't read this format, or the file isn't an image.
    if (!(await isHeic(file))) {
      throw new ImageConversionError("Couldn't read that image — try a JPEG or PNG.")
    }
  }

  try {
    return await decodeHeic(file)
  } catch {
    throw new ImageConversionError(
      "Couldn't convert that HEIC photo. Try again, or save it as a JPEG first."
    )
  }
}

/**
 * Decode `file`, rotate it upright, cap its longest edge at {@link MAX_EDGE},
 * and return it as a JPEG. Formats the browser already understands take the
 * fast path; HEIC falls back to a lazily-loaded WASM decoder.
 */
export async function toUploadableJpeg(file: File): Promise<File> {
  const bitmap = await decode(file)

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageConversionError("Couldn't read that image.")
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) throw new ImageConversionError("Couldn't read that image.")

    return new File([blob], 'label.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
