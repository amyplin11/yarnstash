import { createHash } from 'crypto'
import sharp from 'sharp'
import { extractImages, getDocumentProxy } from 'unpdf'

// Pattern PDFs carry a lot of small decoration — designer logos, social
// icons, bullet glyphs, background textures. Anything below this on its short
// side is almost never a photo, chart, or schematic worth showing.
const MIN_SIDE_PX = 150

// A 40-page pattern can embed one image per page plus repeats; past this the
// gallery stops being useful and storage just grows.
const MAX_IMAGES = 40

// Print PDFs often embed 300dpi originals several thousand pixels wide. Cap
// the long side so a gallery page doesn't download tens of megabytes.
const MAX_SIDE_PX = 1600

const WEBP_QUALITY = 80

export interface PdfImage {
  /** 1-based page the image appears on. */
  page: number
  width: number
  height: number
  /** WebP bytes. */
  data: Buffer
}

/**
 * Pulls embedded raster images (photos, scanned charts) out of a PDF.
 *
 * Vector artwork — charts or schematics drawn as paths — is not an image in
 * the PDF and is not returned; that would need page rendering.
 *
 * Images repeated across pages (a logo in every footer) are kept once, at the
 * first page they appear on.
 */
export async function extractPdfImages(pdfBytes: Uint8Array): Promise<PdfImage[]> {
  // pdf.js takes ownership of (and may detach) the buffer it is given.
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes))
  const seen = new Set<string>()
  const images: PdfImage[] = []

  try {
    for (let page = 1; page <= pdf.numPages && images.length < MAX_IMAGES; page++) {
      let pageImages: Awaited<ReturnType<typeof extractImages>>
      try {
        pageImages = await extractImages(pdf, page)
      } catch (error) {
        // One malformed image stream shouldn't cost the rest of the document.
        console.warn(`[pdf-images] skipping page ${page}:`, error)
        continue
      }

      for (const img of pageImages) {
        if (images.length >= MAX_IMAGES) break
        if (Math.min(img.width, img.height) < MIN_SIDE_PX) continue

        const digest = createHash('sha1').update(img.data).digest('hex')
        if (seen.has(digest)) continue
        seen.add(digest)

        const { data, info } = await sharp(img.data, {
          raw: { width: img.width, height: img.height, channels: img.channels },
        })
          .resize({
            width: MAX_SIDE_PX,
            height: MAX_SIDE_PX,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer({ resolveWithObject: true })

        images.push({ page, width: info.width, height: info.height, data })
      }
    }
  } finally {
    await pdf.loadingTask.destroy()
  }

  return images
}
