'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/Button'
import { CameraIcon, CheckIcon, CloseIcon } from '@/app/components/ui/icons'
import { FEEDBACK_EMAIL } from '@/app/components/feedback/FeedbackButton'
import { useAuth } from '@/lib/auth/AuthContext'
import { catalogYarnToYarn, type CatalogYarn } from '@/lib/types'

/** Details that belong to this skein, not to the catalog entry. */
const EMPTY = {
  colorway: '',
  skeins: '1',
  purchase_price: '',
  purchase_date: '',
  location: '',
  notes: '',
}

const fieldStyles =
  'w-full rounded-2xl border border-line-strong bg-parchment px-4 py-3 text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-terracotta'

/** Loose comparison so "Malabrigo!" and "malabrigo" count as the same brand. */
function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Ball bands print the trading name, the catalog stores the company name —
 * "Malabrigo" on the label vs "Malabrigo Yarn" in the import. Containment
 * bridges that; the yarn name itself still has to match outright.
 */
function brandMatches(a: string | null | undefined, b: string | null | undefined) {
  const x = normalize(a)
  const y = normalize(b)
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x))
}

/** Longest edge sent to the API. Enough for label text without 12MP of noise. */
const MAX_EDGE = 2000

/**
 * Re-encode whatever the picker handed us as JPEG.
 *
 * iPhones shoot HEIC, which the Messages API doesn't accept — but Apple
 * platforms can *decode* it, so drawing to a canvas and exporting JPEG makes
 * those photos usable. It also honours the EXIF rotation (a sideways label
 * reads badly) and shrinks a 12MP photo to something worth uploading.
 */
async function toJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  )
  if (!blob) throw new Error('Could not read that image')
  return new File([blob], 'label.jpg', { type: 'image/jpeg' })
}

function looksLikeHeic(file: File) {
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block text-left ${className}`}>
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

/**
 * Adds a skein to the stash by pointing at a yarn in the global catalog, so the
 * stash row carries a ravelry_yarn_id rather than free text that can't be
 * matched later. Yarns that genuinely aren't in the catalog go to us by email
 * instead of being invented locally.
 */
export function AddYarnDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Catalog lookup
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogYarn[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<CatalogYarn | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Photo scan
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [open, onClose])

  if (!open) return null

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const runSearch = async (q: string): Promise<CatalogYarn[]> => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return []
    }
    setSearching(true)
    try {
      const response = await fetch(
        `/api/yarns?query=${encodeURIComponent(q)}&page_size=8&sort=rating`
      )
      const data = await response.json()
      const found: CatalogYarn[] = response.ok ? data.yarns ?? [] : []
      setResults(found)
      setSearched(true)
      return found
    } catch {
      setResults([])
      setSearched(true)
      return []
    } finally {
      setSearching(false)
    }
  }

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setQuery(next)
    setSelected(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => runSearch(next), 300)
  }

  /** Read a ball band, then use it to find the yarn in the catalog. */
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const photo = e.target.files?.[0]
    e.target.value = '' // let the same photo be re-picked after a failure
    if (!photo) return

    setScanning(true)
    setError(null)
    setScanned(null)
    try {
      let jpeg: File
      try {
        jpeg = await toJpeg(photo)
      } catch {
        throw new Error(
          looksLikeHeic(photo)
            ? "This browser can't open HEIC photos. Open YarnStash in Safari on your iPhone, or set Settings → Camera → Formats → Most Compatible to shoot JPEG."
            : "Couldn't read that image. Try a JPEG or PNG."
        )
      }

      const body = new FormData()
      body.append('image', jpeg)
      const response = await fetch('/api/stash/analyze', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to read the photo')

      const label = data.yarn as Record<string, string | number | null>
      const brand = (label.brand as string) || ''
      const name = (label.name as string) || ''
      const colorway = (label.colorway as string) || ''

      if (colorway) setForm((prev) => ({ ...prev, colorway }))

      if (!brand && !name) {
        setError("Couldn't make out the brand or yarn name. Try a closer photo, or search below.")
        return
      }

      const searchText = [brand, name].filter(Boolean).join(' ')
      setQuery(searchText)
      const found = await runSearch(searchText)

      // Auto-select only on an unambiguous hit — otherwise the user picks from
      // the candidates rather than silently getting the wrong yarn.
      const exact = found.filter(
        (y) => brandMatches(y.yarn_company_name, brand) && normalize(y.name) === normalize(name)
      )
      const match = exact.length === 1 ? exact[0] : null
      if (match) {
        setSelected(match)
        setScanned(
          `Matched to ${match.yarn_company_name} ${match.name}${colorway ? ` in ${colorway}` : ''}.`
        )
      } else if (found.length > 0) {
        setScanned(`Read "${searchText}" from the label — pick the right match below.`)
      } else {
        setScanned(`Read "${searchText}" from the label, but found no catalog match.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the photo')
    } finally {
      setScanning(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) {
      setError('Choose the yarn from the catalog first.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const yarn = catalogYarnToYarn(selected)
      const response = await fetch('/api/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ravelry_yarn_id: String(selected.ravelry_id),
          brand: yarn.brand,
          name: yarn.name,
          weight: yarn.weight,
          fiber_content: yarn.fiberContent,
          yardage: yarn.yardage,
          grams_per_skein: yarn.gramsPerSkein,
          image_url: yarn.imageUrl,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add yarn')

      setForm(EMPTY)
      setSelected(null)
      setQuery('')
      setResults([])
      setSearched(false)
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add yarn')
    } finally {
      setSaving(false)
    }
  }

  const submitNewYarnHref = () => {
    const subject = `YarnStash: yarn missing from the catalog — ${query || 'new yarn'}`
    const body = [
      "This yarn isn't in the catalog. Please add it:",
      '',
      `Yarn: ${query}`,
      `Colorway: ${form.colorway || '(not given)'}`,
      '',
      'Brand, weight, fiber, yardage, or a link — anything that helps:',
      '',
      '---',
      `Account: ${user?.email ?? 'not signed in'}`,
    ].join('\n')
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const noMatches = searched && !searching && results.length === 0 && query.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-yarn-title"
        className="relative w-full max-w-2xl rounded-[2rem] border border-line bg-surface p-8 shadow-[0_30px_80px_-40px_rgba(28,26,23,0.7)] sm:p-10"
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2 text-terracotta">Add to stash</p>
            <h2 id="add-yarn-title" className="font-display text-3xl tracking-tight text-ink">
              A new yarn
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-soft transition-colors hover:bg-parchment-deep hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scan a ball band to find the yarn without typing */}
        <div className="mb-6 rounded-2xl border border-dashed border-line-strong bg-parchment px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-ink">Scan the ball band</p>
              <p className="text-sm text-ink-soft">
                Take a photo and we&apos;ll look the yarn up for you.
              </p>
            </div>
            <input
              type="file"
              id="yarn-label-photo"
              accept="image/*,.heic,.heif"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
              disabled={scanning}
            />
            <label
              htmlFor="yarn-label-photo"
              aria-disabled={scanning}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors ${
                scanning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-parchment-deep'
              }`}
            >
              <CameraIcon className="h-4 w-4" />
              {scanning ? 'Reading label…' : 'Take a photo'}
            </label>
          </div>
        </div>

        {scanned && (
          <div className="mb-6 rounded-2xl bg-sage-soft px-5 py-4">
            <p className="text-sm font-medium text-sage-deep">{scanned}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl bg-clay-soft px-5 py-4">
            <p className="text-sm font-medium text-clay">{error}</p>
          </div>
        )}

        {/* Catalog lookup — a stash entry always points at a catalog yarn */}
        <div className="mb-6">
          <Field label="Which yarn?">
            <input
              className={fieldStyles}
              value={query}
              onChange={handleQueryChange}
              placeholder="Search the catalog — e.g. Malabrigo Rios"
              autoFocus
              autoComplete="off"
            />
          </Field>

          {searching && <p className="mt-3 text-sm text-ink-soft">Searching the catalog…</p>}

          {selected ? (
            <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-sage-soft px-5 py-4 text-left">
              <div className="flex min-w-0 items-start gap-3">
                <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sage-deep" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {selected.yarn_company_name} {selected.name}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {[
                      selected.yarn_weight_name,
                      selected.fiber_content,
                      selected.yardage ? `${selected.yardage} yds` : null,
                      selected.grams ? `${selected.grams} g` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-ink-muted transition-colors hover:text-ink"
              >
                Change
              </button>
            </div>
          ) : (
            results.length > 0 && (
              <ul className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-line">
                {results.map((yarn) => (
                  <li key={yarn.ravelry_id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSelected(yarn)}
                      className="w-full px-5 py-3 text-left transition-colors hover:bg-parchment"
                    >
                      <p className="font-medium text-ink">
                        {yarn.yarn_company_name} {yarn.name}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {[
                          yarn.yarn_weight_name,
                          yarn.fiber_content,
                          yarn.yardage ? `${yarn.yardage} yds` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {noMatches && !selected && (
            <div className="mt-4 rounded-2xl border border-line bg-parchment px-5 py-4">
              <p className="font-medium text-ink">Not in the catalog</p>
              <p className="mt-1 text-sm text-ink-muted">
                Nothing matches &ldquo;{query}&rdquo;. Send it to us and we&apos;ll add it.
              </p>
              <a
                href={submitNewYarnHref()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-terracotta"
              >
                Submit a new yarn
              </a>
            </div>
          )}
        </div>

        {/* This skein's own details */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Colorway">
            <input
              className={fieldStyles}
              value={form.colorway}
              onChange={set('colorway')}
              placeholder="Sapphire"
            />
          </Field>

          <Field label="Skeins">
            <input
              type="number"
              min="1"
              className={fieldStyles}
              value={form.skeins}
              onChange={set('skeins')}
            />
          </Field>

          <Field label="Price paid">
            <input
              type="number"
              min="0"
              step="0.01"
              className={fieldStyles}
              value={form.purchase_price}
              onChange={set('purchase_price')}
              placeholder="24.00"
            />
          </Field>

          <Field label="Purchase date">
            <input
              type="date"
              className={fieldStyles}
              value={form.purchase_date}
              onChange={set('purchase_date')}
            />
          </Field>

          <Field label="Where it lives" className="sm:col-span-2">
            <input
              className={fieldStyles}
              value={form.location}
              onChange={set('location')}
              placeholder="Bin 3, closet"
            />
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <textarea
              rows={3}
              className={fieldStyles}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Saved for a winter hat"
            />
          </Field>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
            {!selected && (
              <p className="mr-auto text-sm text-ink-soft">Pick a yarn from the catalog to save.</p>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !selected}>
              {saving ? 'Adding…' : 'Add to stash'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
