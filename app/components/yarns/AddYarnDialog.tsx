'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/Button'
import { CloseIcon } from '@/app/components/ui/icons'
import type { YarnWeight } from '@/lib/types'

const WEIGHTS: YarnWeight[] = [
  'lace',
  'light-fingering',
  'fingering',
  'sport',
  'dk',
  'worsted',
  'aran',
  'bulky',
  'super-bulky',
  'jumbo',
]

const EMPTY = {
  brand: '',
  name: '',
  colorway: '',
  weight: 'worsted' as YarnWeight,
  fiber_content: '',
  skeins: '1',
  yardage: '',
  grams_per_skein: '',
  purchase_price: '',
  purchase_date: '',
  location: '',
  notes: '',
}

const fieldStyles =
  'w-full rounded-2xl border border-line-strong bg-parchment px-4 py-3 text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-terracotta'

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
 * Hand-entry for yarn that isn't in the Ravelry catalog — indie dyers,
 * handspun, the odd skein from a destash.
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
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.brand.trim() || !form.name.trim()) {
      setError('Brand and yarn name are required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add yarn')

      setForm(EMPTY)
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add yarn')
    } finally {
      setSaving(false)
    }
  }

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

        {error && (
          <div className="mb-6 rounded-2xl bg-clay-soft px-5 py-4">
            <p className="text-sm font-medium text-clay">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Brand">
            <input
              className={fieldStyles}
              value={form.brand}
              onChange={set('brand')}
              placeholder="Malabrigo"
              autoFocus
              required
            />
          </Field>

          <Field label="Yarn name">
            <input
              className={fieldStyles}
              value={form.name}
              onChange={set('name')}
              placeholder="Rios"
              required
            />
          </Field>

          <Field label="Colorway">
            <input
              className={fieldStyles}
              value={form.colorway}
              onChange={set('colorway')}
              placeholder="Sapphire"
            />
          </Field>

          <Field label="Weight">
            <select className={fieldStyles} value={form.weight} onChange={set('weight')}>
              {WEIGHTS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fiber content" className="sm:col-span-2">
            <input
              className={fieldStyles}
              value={form.fiber_content}
              onChange={set('fiber_content')}
              placeholder="100% merino wool"
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

          <Field label="Yards per skein">
            <input
              type="number"
              min="0"
              className={fieldStyles}
              value={form.yardage}
              onChange={set('yardage')}
              placeholder="210"
            />
          </Field>

          <Field label="Grams per skein">
            <input
              type="number"
              min="0"
              className={fieldStyles}
              value={form.grams_per_skein}
              onChange={set('grams_per_skein')}
              placeholder="100"
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

          <Field label="Where it lives">
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

          <div className="mt-2 flex justify-end gap-3 sm:col-span-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add to stash'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
