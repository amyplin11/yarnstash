'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/Button'
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  CloseIcon,
  FileIcon,
  SearchIcon,
} from '@/app/components/ui/icons'
import { FEEDBACK_EMAIL } from '@/app/components/feedback/FeedbackButton'
import { ReceiptImport } from './ReceiptImport'
import { useAuth } from '@/lib/auth/AuthContext'
import { toUploadableJpeg } from '@/lib/images/to-jpeg'
import { pickExactMatch, searchCatalog } from '@/lib/yarns/match'
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

/** Which way the user chose to find their yarn. */
type Mode = 'choose' | 'photo' | 'search' | 'receipt'

const fieldStyles =
  'w-full rounded-2xl border border-line-strong bg-parchment px-4 py-3 text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-terracotta'

/**
 * Blank optional fields have to travel as null, not "". `purchase_price` is
 * numeric and `purchase_date` is a date, and Postgres rejects an empty string
 * for both — which is most saves, since few people fill either in.
 */
function optionalText(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function optionalNumber(value: string) {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
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

/** One of the two big "how do you want to find it?" tiles. */
function MethodCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-line-strong bg-parchment px-6 py-7 text-left transition-colors hover:border-terracotta hover:bg-terracotta-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-terracotta">
        {icon}
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </button>
  )
}

/**
 * Adds a skein to the stash by pointing at a yarn in the global catalog, so the
 * stash row carries a ravelry_yarn_id rather than free text that can't be
 * matched later. Yarns that genuinely aren't in the catalog go to us by email
 * instead of being invented locally.
 *
 * The user picks a route in first — photograph the ball band, or search — but
 * the two converge on the same catalog picker, because the saved row has to
 * name a catalog yarn either way.
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
  const [mode, setMode] = useState<Mode>('choose')
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

  // Reopening should feel like a fresh start, not a half-filled form.
  useEffect(() => {
    if (!open) return
    setMode('choose')
    setForm(EMPTY)
    setError(null)
    setQuery('')
    setResults([])
    setSearched(false)
    setSelected(null)
    setScanned(null)
  }, [open])

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

  /** Swap routes, dropping anything the abandoned one had found. */
  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setScanned(null)
    setQuery('')
    setResults([])
    setSearched(false)
    setSelected(null)
  }

  const runSearch = async (q: string): Promise<CatalogYarn[]> => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return []
    }
    setSearching(true)
    try {
      const found = await searchCatalog(q)
      setResults(found)
      setSearched(true)
      return found
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
      // Decodes the HEIC an iPhone hands over, and shrinks the 12MP original.
      const jpeg = await toUploadableJpeg(photo)

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
        // Reveal the search box so they can type it rather than start over.
        setSearched(true)
        setError(
          "Couldn't make out the brand or yarn name. Try a closer photo, or search for it below."
        )
        return
      }

      const searchText = [brand, name].filter(Boolean).join(' ')
      setQuery(searchText)
      const found = await runSearch(searchText)

      // Auto-select only on an unambiguous hit — otherwise the user picks from
      // the candidates rather than silently getting the wrong yarn.
      const match = pickExactMatch(found, brand, name)
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
      // ImageConversionError messages are written for the user; so are the
      // `error` strings the analyze route returns.
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
          colorway: optionalText(form.colorway),
          // `skeins` is a required integer, so it always needs a real value.
          skeins: Math.max(1, Math.round(Number(form.skeins) || 1)),
          purchase_price: optionalNumber(form.purchase_price),
          purchase_date: optionalText(form.purchase_date),
          location: optionalText(form.location),
          notes: optionalText(form.notes),
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

  // In photo mode the search box only appears once a scan has run, so a misread
  // label can be corrected without starting over.
  const showSearchField = mode === 'search' || (mode === 'photo' && searched)

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

        {/* Step 1 — how do you want to find it? */}
        {mode === 'choose' ? (
          <div>
            <div className="grid gap-4 sm:grid-cols-3">
              <MethodCard
                icon={<CameraIcon className="h-5 w-5" />}
                title="Take a pic"
                description="Photograph the ball band and we'll look the yarn up."
                onClick={() => switchMode('photo')}
              />
              <MethodCard
                icon={<SearchIcon className="h-5 w-5" />}
                title="Search manually"
                description="Type the brand and yarn name to find it in the catalog."
                onClick={() => switchMode('search')}
              />
              <MethodCard
                icon={<FileIcon className="h-5 w-5" />}
                title="Upload a receipt"
                description="Add a whole order at once, straight off the confirmation."
                onClick={() => switchMode('receipt')}
              />
            </div>

            <p className="mt-6 text-sm text-ink-soft">
              Whichever way, you&apos;ll pick the yarn from our catalog, so your stash stays linked
              to real yardage and gauge. Anything we don&apos;t have yet, you can ask us to add.
            </p>

            <div className="mt-8 flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => switchMode('choose')}
              className="mb-6 inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Choose another way
            </button>

            {/* A receipt carries a whole order, so it owns its own review flow */}
            {mode === 'receipt' && <ReceiptImport onClose={onClose} onAdded={onAdded} />}

            {/* Step 2a — read the ball band */}
            {mode === 'photo' && (
              <div className="mb-6 rounded-2xl border border-dashed border-line-strong bg-parchment px-6 py-8 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-terracotta">
                  <CameraIcon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-medium text-ink">Photograph the ball band</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                  The paper label wrapped around the skein. Keep the brand and yarn name in frame
                  and in focus.
                </p>
                <input
                  type="file"
                  id="yarn-label-photo"
                  accept="image/*,.heic,.heif"
                  onChange={handlePhoto}
                  className="hidden"
                  disabled={scanning}
                />
                <label
                  htmlFor="yarn-label-photo"
                  aria-disabled={scanning}
                  className={`mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors ${
                    scanning
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:bg-parchment-deep'
                  }`}
                >
                  <CameraIcon className="h-4 w-4" />
                  {scanning ? 'Reading label…' : 'Take a photo'}
                </label>
                <p className="mt-4 text-xs text-ink-soft">
                  JPEG, PNG, WebP or HEIC — iPhone photos are converted for you.
                </p>
              </div>
            )}

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

            {/* Step 2b — the catalog picker, shared by the photo and search routes */}
            <div className={`mb-6 ${mode === 'receipt' ? 'hidden' : ''}`}>
              {showSearchField && (
                <Field label="Which yarn?">
                  <input
                    className={fieldStyles}
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="Search the catalog — e.g. Malabrigo Rios"
                    autoFocus={mode === 'search'}
                    autoComplete="off"
                  />
                </Field>
              )}

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
                  <>
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
                    <p className="mt-3 text-sm text-ink-soft">
                      None of these it?{' '}
                      <a
                        href={submitNewYarnHref()}
                        className="text-terracotta underline underline-offset-2"
                      >
                        Request a new yarn
                      </a>
                      .
                    </p>
                  </>
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
                    Request a new yarn
                  </a>
                </div>
              )}
            </div>

            {/* Step 3 — this skein's own details, once a catalog yarn is picked */}
            {mode === 'receipt' ? null : selected ? (
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
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? 'Adding…' : 'Add to stash'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="mr-auto text-sm text-ink-soft">
                  Pick a yarn from the catalog to fill in the rest.
                </p>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
