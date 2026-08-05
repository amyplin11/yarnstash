'use client'

import { useEffect, useState } from 'react'
import { StashYarn } from '@/lib/types'
import { Button } from '@/app/components/ui/Button'
import { CloseIcon, MinusIcon, PlusIcon } from '@/app/components/ui/icons'
import { MIN_SKEINS } from '@/lib/stash/fields'

interface StashEntryDialogProps {
  /** The row being edited; `null` closes the dialog. */
  entry: StashYarn | null
  onClose: () => void
  /** Called after a successful save or delete so the page can refetch. */
  onChanged: () => void | Promise<void>
}

/**
 * Opened by clicking a stash row or card. Adjusts how many skeins of a yarn
 * are on hand, or drops the yarn from the stash entirely.
 *
 * Skeins only commit on save, so the count can be nudged past the number the
 * user actually wants without firing a request per click.
 */
export function StashEntryDialog({ entry, onClose, onChanged }: StashEntryDialogProps) {
  const [skeins, setSkeins] = useState(MIN_SKEINS)
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Reset every time a different row is opened, so the previous row's edits
  // and errors don't bleed into this one.
  useEffect(() => {
    if (!entry) return
    setSkeins(entry.skeins)
    setError(null)
    setConfirmingDelete(false)
    setBusy(null)
  }, [entry])

  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entry, onClose])

  if (!entry) return null

  const yarn = entry.yarn
  const changed = skeins !== entry.skeins

  const save = async () => {
    if (!changed) {
      onClose()
      return
    }
    setBusy('saving')
    setError(null)
    try {
      const response = await fetch(`/api/stash/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skeins }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update this yarn')
      }
      await onChanged()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update this yarn')
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('deleting')
    setError(null)
    try {
      const response = await fetch(`/api/stash/${entry.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to remove this yarn')
      }
      await onChanged()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove this yarn')
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />

      {/*
        min-h-full plus items-center centres the panel in the viewport while
        still letting the container scroll if the dialog ever outgrows it.
        items-center directly on the scroll container would centre it too, but
        clips the top out of reach once the content is taller than the screen.
      */}
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stash-entry-title"
          className="relative w-full max-w-md rounded-[2rem] border border-line bg-surface p-8 shadow-[0_30px_80px_-40px_rgba(28,26,23,0.7)]"
        >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-2 text-terracotta">In your stash</p>
            <h2
              id="stash-entry-title"
              className="font-display text-3xl tracking-tight text-ink break-words"
            >
              {yarn.name}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {yarn.brand}
              {entry.colorway ? ` · ${entry.colorway}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:bg-parchment-deep hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Skein stepper */}
        <div className="mb-8">
          <label
            htmlFor="stash-skeins"
            className="mb-3 block text-xs font-semibold uppercase tracking-wider text-ink-soft"
          >
            Skeins
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSkeins((n) => Math.max(MIN_SKEINS, n - 1))}
              disabled={skeins <= MIN_SKEINS || busy !== null}
              aria-label="One fewer skein"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MinusIcon className="h-4 w-4" />
            </button>

            <input
              id="stash-skeins"
              type="number"
              min={MIN_SKEINS}
              value={skeins}
              disabled={busy !== null}
              onChange={(e) => {
                const next = Number(e.target.value)
                // An empty or half-typed field parses to NaN; hold the floor
                // rather than letting the count jump around while typing.
                setSkeins(Number.isFinite(next) ? Math.max(MIN_SKEINS, Math.round(next)) : MIN_SKEINS)
              }}
              className="w-24 rounded-xl border border-line bg-parchment px-4 py-2.5 text-center text-lg tabular-nums text-ink focus:border-terracotta focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setSkeins((n) => n + 1)}
              disabled={busy !== null}
              aria-label="One more skein"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon className="h-4 w-4" />
            </button>

            {yarn.yardage > 0 && (
              <p className="text-sm text-ink-muted">
                {(yarn.yardage * skeins).toLocaleString()} yds total
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            A stash row holds at least one skein — use Delete all to drop the yarn entirely.
          </p>
        </div>

        {error && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">Delete all of it?</span>
              <Button variant="primary" size="sm" onClick={remove} disabled={busy !== null}>
                {busy === 'deleting' ? 'Deleting…' : 'Yes, delete all'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy !== null}
              >
                Keep
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
            >
              Delete all
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={busy !== null || !changed}>
              {busy === 'saving' ? 'Saving…' : 'Save'}
            </Button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
