'use client'

import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/Button'
import { CheckIcon, FileIcon } from '@/app/components/ui/icons'
import { FEEDBACK_EMAIL } from '@/app/components/feedback/FeedbackButton'
import { useAuth } from '@/lib/auth/AuthContext'
import { toUploadableJpeg } from '@/lib/images/to-jpeg'
import { pickExactMatch, searchCatalog } from '@/lib/yarns/match'
import { catalogYarnToYarn, type CatalogYarn } from '@/lib/types'

/** One yarn line read off the receipt, plus how it resolved against the catalog. */
interface Row {
  key: string
  /** What the receipt actually said, kept verbatim for the "we read…" line. */
  read: { brand: string; name: string; colorway: string }
  skeins: string
  price: number | null
  query: string
  results: CatalogYarn[]
  selected: CatalogYarn | null
  searching: boolean
  include: boolean
}

interface ReceiptItem {
  brand: string | null
  name: string | null
  colorway: string | null
  quantity: number | null
  line_total: number | null
}

const fieldStyles =
  'w-full rounded-2xl border border-line-strong bg-parchment px-4 py-2.5 text-sm text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-terracotta'

function describe(read: Row['read']) {
  return [read.brand, read.name].filter(Boolean).join(' ') || 'Unnamed yarn'
}

function summarise(yarn: CatalogYarn) {
  return [
    yarn.yarn_weight_name,
    yarn.fiber_content,
    yarn.yardage ? `${yarn.yardage} yds` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Imports a whole order at once: read the receipt, resolve every line to a
 * catalog yarn, then add the ones the user confirms. Same catalog-only rule as
 * the single-yarn flow — a row with no match can't be saved, only reported.
 */
export function ReceiptImport({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: () => void
}) {
  const { user } = useAuth()
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [retailer, setRetailer] = useState<string | null>(null)
  const [orderDate, setOrderDate] = useState<string | null>(null)
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const patch = (key: string, changes: Partial<Row>) =>
    setRows((prev) => prev?.map((row) => (row.key === key ? { ...row, ...changes } : row)) ?? prev)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after a failure
    if (!file) return

    setReading(true)
    setError(null)
    setRows(null)
    try {
      // PDFs go up untouched; photos and screenshots get the HEIC-aware
      // re-encode and downscale first.
      const upload =
        file.type === 'application/pdf' ? file : await toUploadableJpeg(file)

      const body = new FormData()
      body.append('receipt', upload)
      const response = await fetch('/api/stash/receipt', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to read the receipt')

      const items: ReceiptItem[] = Array.isArray(data.items) ? data.items : []
      if (items.length === 0) {
        setError(
          "Couldn't find any yarn on that receipt. Try a clearer copy, or add the yarns one at a time."
        )
        return
      }

      setRetailer(data.retailer ?? null)
      setOrderDate(typeof data.order_date === 'string' ? data.order_date : null)

      const initial: Row[] = items.map((item, index) => {
        const brand = item.brand ?? ''
        const name = item.name ?? ''
        return {
          key: `${index}`,
          read: { brand, name, colorway: item.colorway ?? '' },
          skeins: String(Math.max(1, Math.round(item.quantity ?? 1))),
          price: typeof item.line_total === 'number' ? item.line_total : null,
          query: [brand, name].filter(Boolean).join(' '),
          results: [],
          selected: null,
          searching: true,
          include: true,
        }
      })
      setRows(initial)

      // Resolve every line against the catalog at once — the rows are
      // independent, so there's no reason to walk them serially.
      const resolved = await Promise.all(
        initial.map(async (row) => {
          const results = await searchCatalog(row.query)
          return {
            ...row,
            results,
            selected: pickExactMatch(results, row.read.brand, row.read.name),
            searching: false,
          }
        })
      )
      setRows(resolved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the receipt')
    } finally {
      setReading(false)
    }
  }

  const handleQueryChange = (key: string, next: string) => {
    patch(key, { query: next, selected: null })
    clearTimeout(searchTimers.current[key])
    searchTimers.current[key] = setTimeout(async () => {
      patch(key, { searching: true })
      const results = await searchCatalog(next)
      patch(key, { results, searching: false })
    }, 300)
  }

  const handleSave = async () => {
    if (!rows) return
    const chosen = rows.filter((row) => row.include && row.selected)
    if (chosen.length === 0) return

    setSaving(true)
    setError(null)
    try {
      const results = await Promise.all(
        chosen.map(async (row) => {
          const catalog = row.selected!
          const yarn = catalogYarnToYarn(catalog)
          const response = await fetch('/api/stash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ravelry_yarn_id: String(catalog.ravelry_id),
              brand: yarn.brand,
              name: yarn.name,
              weight: yarn.weight,
              fiber_content: yarn.fiberContent,
              yardage: yarn.yardage,
              grams_per_skein: yarn.gramsPerSkein,
              image_url: yarn.imageUrl,
              colorway: row.read.colorway.trim() || null,
              skeins: Math.max(1, Math.round(Number(row.skeins) || 1)),
              // Blank optional fields must be null, not "" — purchase_price is
              // numeric and purchase_date is a date in Postgres.
              purchase_price: row.price,
              purchase_date: orderDate,
              location: null,
              notes: null,
            }),
          })
          return response.ok
        })
      )

      const failed = results.filter((ok) => !ok).length
      if (failed > 0) {
        setError(
          `Added ${results.length - failed} of ${results.length}. ${failed} couldn't be saved — try those again.`
        )
        onAdded()
        return
      }

      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add the yarns')
    } finally {
      setSaving(false)
    }
  }

  const requestHref = (row: Row) => {
    const subject = `YarnStash: yarn missing from the catalog — ${describe(row.read)}`
    const body = [
      "This yarn isn't in the catalog. Please add it:",
      '',
      `Yarn: ${describe(row.read)}`,
      `Colorway: ${row.read.colorway || '(not given)'}`,
      retailer ? `Bought from: ${retailer}` : null,
      '',
      'Brand, weight, fiber, yardage, or a link — anything that helps:',
      '',
      '---',
      `Account: ${user?.email ?? 'not signed in'}`,
    ]
      .filter((line) => line !== null)
      .join('\n')
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const ready = rows?.filter((row) => row.include && row.selected).length ?? 0
  const unmatched = rows?.filter((row) => row.include && !row.selected).length ?? 0

  return (
    <>
      {!rows && (
        <div className="mb-6 rounded-2xl border border-dashed border-line-strong bg-parchment px-6 py-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-terracotta">
            <FileIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium text-ink">Upload your receipt</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            An order confirmation, emailed receipt, or a screenshot of the order summary. We&apos;ll
            pull out every yarn on it.
          </p>
          <input
            type="file"
            id="yarn-receipt"
            accept="application/pdf,image/*,.heic,.heif"
            onChange={handleFile}
            className="hidden"
            disabled={reading}
          />
          <label
            htmlFor="yarn-receipt"
            aria-disabled={reading}
            className={`mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors ${
              reading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-parchment-deep'
            }`}
          >
            <FileIcon className="h-4 w-4" />
            {reading ? 'Reading receipt…' : 'Choose a receipt'}
          </label>
          <p className="mt-4 text-xs text-ink-soft">
            PDF, JPEG, PNG, WebP or HEIC — iPhone photos are converted for you.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl bg-clay-soft px-5 py-4">
          <p className="text-sm font-medium text-clay">{error}</p>
        </div>
      )}

      {rows && (
        <>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-ink-muted">
              Found {rows.length} {rows.length === 1 ? 'yarn' : 'yarns'}
              {retailer ? ` from ${retailer}` : ''}
              {orderDate ? `, ordered ${orderDate}` : ''}.
            </p>
            {unmatched > 0 && (
              <p className="text-sm text-clay">
                {unmatched} {unmatched === 1 ? 'needs' : 'need'} a catalog match
              </p>
            )}
          </div>

          <ul className="mb-6 space-y-4">
            {rows.map((row) => (
              <li
                key={row.key}
                className={`rounded-2xl border px-5 py-4 transition-opacity ${
                  row.include ? 'border-line bg-surface' : 'border-line bg-parchment opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{describe(row.read)}</p>
                    <p className="text-sm text-ink-soft">
                      {[
                        row.read.colorway || null,
                        `${row.skeins} ${Number(row.skeins) === 1 ? 'skein' : 'skeins'}`,
                        row.price !== null ? `$${row.price.toFixed(2)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => patch(row.key, { include: e.target.checked })}
                      className="h-4 w-4 accent-terracotta"
                    />
                    Add
                  </label>
                </div>

                {row.include && (
                  <div className="mt-4">
                    {row.searching ? (
                      <p className="text-sm text-ink-soft">Looking it up in the catalog…</p>
                    ) : row.selected ? (
                      <div className="flex items-start justify-between gap-4 rounded-xl bg-sage-soft px-4 py-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-sage-deep" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {row.selected.yarn_company_name} {row.selected.name}
                            </p>
                            <p className="text-xs text-ink-muted">{summarise(row.selected)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => patch(row.key, { selected: null })}
                          className="shrink-0 text-sm text-ink-muted transition-colors hover:text-ink"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          className={fieldStyles}
                          value={row.query}
                          onChange={(e) => handleQueryChange(row.key, e.target.value)}
                          placeholder="Search the catalog"
                          autoComplete="off"
                        />
                        {row.results.length > 0 ? (
                          <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-line">
                            {row.results.map((yarn) => (
                              <li
                                key={yarn.ravelry_id}
                                className="border-b border-line last:border-b-0"
                              >
                                <button
                                  type="button"
                                  onClick={() => patch(row.key, { selected: yarn })}
                                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-parchment"
                                >
                                  <p className="text-sm font-medium text-ink">
                                    {yarn.yarn_company_name} {yarn.name}
                                  </p>
                                  <p className="text-xs text-ink-soft">{summarise(yarn)}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-ink-muted">
                            No catalog match.{' '}
                            <a
                              href={requestHref(row)}
                              className="text-terracotta underline underline-offset-2"
                            >
                              Request a new yarn
                            </a>
                            , or untick it to skip.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {unmatched > 0 && (
              <p className="mr-auto text-sm text-ink-soft">
                Only matched yarns are added — untick anything you want to skip.
              </p>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || ready === 0}>
              {saving ? 'Adding…' : `Add ${ready} to stash`}
            </Button>
          </div>
        </>
      )}

      {!rows && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}
    </>
  )
}
