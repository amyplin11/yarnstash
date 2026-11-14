'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/app/components/ui/Card'
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from '@/app/components/ui/icons'

interface PatternImage {
  url: string
  page: number
  width: number
  height: number
}

interface PatternImagesProps {
  patternId: string
  className?: string
}

/**
 * Photos, charts, and schematics pulled out of the pattern's PDF. Renders
 * nothing when the PDF had no images or they couldn't be loaded — the gallery
 * is supplementary, so a failure here shouldn't put an error on the page.
 */
export function PatternImages({ patternId, className = '' }: PatternImagesProps) {
  const [images, setImages] = useState<PatternImage[]>([])
  const [loading, setLoading] = useState(true)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patterns/${patternId}/images`)
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((body: { images?: PatternImage[] }) => {
        if (!cancelled) setImages(body.images ?? [])
      })
      .catch(() => {
        if (!cancelled) setImages([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patternId])

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length]
  )

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex, close, step])

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="h-5 w-32 bg-foreground/10 rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-foreground/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  if (images.length === 0) return null

  const open = openIndex !== null ? images[openIndex] : null

  return (
    <>
      <Card className={`p-6 ${className}`}>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          From the PDF{' '}
          <span className="text-sm font-normal text-foreground/50">
            {images.length} {images.length === 1 ? 'image' : 'images'}
          </span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group text-left"
            >
              {/* Contain, not cover: charts and schematics lose their edges when cropped. */}
              <div className="aspect-square bg-foreground/5 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={img.url}
                  alt={`Image from page ${img.page}`}
                  loading="lazy"
                  className="max-w-full max-h-full object-contain transition-transform group-hover:scale-[1.03]"
                />
              </div>
              <p className="text-xs text-foreground/50 mt-1">Page {img.page}</p>
            </button>
          ))}
        </div>
      </Card>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image from page ${open.page}`}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={close}
        >
          <img
            src={open.url}
            alt={`Image from page ${open.page}`}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            Page {open.page} · {openIndex! + 1} of {images.length}
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <ArrowRightIcon className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
