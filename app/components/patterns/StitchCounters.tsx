'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/app/components/ui/Card'
import type { PatternCounter } from '@/lib/types/pattern'

/**
 * Counting happens a stitch at a time, so every tap must feel instant: the
 * displayed value updates locally and the write is debounced. Only the last
 * value of a burst reaches the server.
 */
const SAVE_DEBOUNCE_MS = 600

interface StitchCountersProps {
  patternId: string
  /** 'full' is the overview card; 'compact' is the strip shown while knitting. */
  variant?: 'full' | 'compact'
  className?: string
}

export function StitchCounters({
  patternId,
  variant = 'full',
  className = '',
}: StitchCountersProps) {
  const [counters, setCounters] = useState<PatternCounter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingRef = useRef<Map<string, number>>(new Map())

  const fetchCounters = useCallback(async () => {
    try {
      const response = await fetch(`/api/patterns/${patternId}/counters`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.setupRequired) {
          setSetupRequired(true)
          return
        }
        throw new Error(result.error || 'Failed to load counters')
      }
      setCounters(result.counters || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load counters')
    } finally {
      setLoading(false)
    }
  }, [patternId])

  useEffect(() => {
    fetchCounters()
  }, [fetchCounters])

  // Leaving the page mid-burst would otherwise drop the debounced write, so
  // any value still waiting on a timer is flushed on the way out.
  useEffect(() => {
    const timers = timersRef.current
    const pending = pendingRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      pending.forEach((value, counterId) => {
        fetch(`/api/patterns/${patternId}/counters/${counterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
          keepalive: true,
        }).catch(() => {})
      })
      pending.clear()
    }
  }, [patternId])

  const saveValue = useCallback(
    async (counterId: string, value: number) => {
      try {
        const response = await fetch(`/api/patterns/${patternId}/counters/${counterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
        if (!response.ok) throw new Error('Failed to save counter')
        setError(null)
      } catch {
        setError('Could not save the counter — check your connection.')
      }
    },
    [patternId]
  )

  const queueSave = useCallback(
    (counterId: string, value: number) => {
      pendingRef.current.set(counterId, value)
      const existing = timersRef.current.get(counterId)
      if (existing) clearTimeout(existing)
      timersRef.current.set(
        counterId,
        setTimeout(() => {
          timersRef.current.delete(counterId)
          const queued = pendingRef.current.get(counterId)
          pendingRef.current.delete(counterId)
          if (queued !== undefined) saveValue(counterId, queued)
        }, SAVE_DEBOUNCE_MS)
      )
    },
    [saveValue]
  )

  const step = useCallback(
    (counter: PatternCounter, delta: number) => {
      const next = Math.max(0, counter.value + delta)
      if (next === counter.value) return
      setCounters((prev) =>
        prev.map((c) => (c.id === counter.id ? { ...c, value: next } : c))
      )
      queueSave(counter.id, next)
    },
    [queueSave]
  )

  const addCounter = useCallback(async () => {
    setAdding(true)
    try {
      const response = await fetch(`/api/patterns/${patternId}/counters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.setupRequired) {
          setSetupRequired(true)
          return
        }
        throw new Error(result.error || 'Failed to add counter')
      }
      setCounters((prev) => [...prev, result.counter])
      setError(null)
      // A fresh counter is nameless by default, so open the rename field.
      setEditingId(result.counter.id)
      setDraftName(result.counter.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add counter')
    } finally {
      setAdding(false)
    }
  }, [patternId])

  const commitRename = useCallback(
    async (counter: PatternCounter) => {
      const name = draftName.trim()
      setEditingId(null)
      if (!name || name === counter.name) return

      const previousName = counter.name
      setCounters((prev) =>
        prev.map((c) => (c.id === counter.id ? { ...c, name } : c))
      )
      try {
        const response = await fetch(`/api/patterns/${patternId}/counters/${counter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!response.ok) throw new Error('Failed to rename counter')
        setError(null)
      } catch {
        setCounters((prev) =>
          prev.map((c) => (c.id === counter.id ? { ...c, name: previousName } : c))
        )
        setError('Could not rename the counter.')
      }
    },
    [draftName, patternId]
  )

  const deleteCounter = useCallback(
    async (counter: PatternCounter) => {
      if (!confirm(`Delete the "${counter.name}" counter?`)) return

      // A pending value for a deleted counter would 404 on flush.
      const timer = timersRef.current.get(counter.id)
      if (timer) clearTimeout(timer)
      timersRef.current.delete(counter.id)
      pendingRef.current.delete(counter.id)

      setCounters((prev) => prev.filter((c) => c.id !== counter.id))
      try {
        const response = await fetch(`/api/patterns/${patternId}/counters/${counter.id}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete counter')
        setError(null)
      } catch {
        setError('Could not delete the counter.')
        fetchCounters()
      }
    },
    [patternId, fetchCounters]
  )

  const startRename = (counter: PatternCounter) => {
    setEditingId(counter.id)
    setDraftName(counter.name)
  }

  const nameField = (counter: PatternCounter, inputClass: string, buttonClass: string) =>
    editingId === counter.id ? (
      <input
        autoFocus
        value={draftName}
        maxLength={60}
        aria-label="Counter name"
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={() => commitRename(counter)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitRename(counter)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setEditingId(null)
          }
        }}
        onFocus={(e) => e.target.select()}
        className={`bg-surface border border-terracotta/40 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 ${inputClass}`}
      />
    ) : (
      <button
        onClick={() => startRename(counter)}
        title="Rename counter"
        className={`text-left rounded-lg px-2 py-1 -mx-2 hover:bg-foreground/5 transition-colors truncate ${buttonClass}`}
      >
        {counter.name}
      </button>
    )

  if (setupRequired) {
    // The table ships as a migration; until it is applied, say so plainly
    // rather than showing a broken counter.
    return (
      <Card className={`p-5 ${variant === 'full' ? 'mb-8' : ''} ${className}`}>
        <h2 className="text-lg font-semibold text-foreground mb-1">Stitch Counters</h2>
        <p className="text-sm text-foreground/60">
          Counters need one database migration:{' '}
          <code className="font-mono text-xs bg-foreground/5 px-1.5 py-0.5 rounded">
            supabase/migrations/011_pattern_counters.sql
          </code>
          . Apply it with <code className="font-mono text-xs">npm run db:push</code>, then reload.
        </p>
      </Card>
    )
  }

  // ─── Compact strip, shown alongside the current step while knitting ───
  if (variant === 'compact') {
    if (loading) return null

    return (
      <div className={className}>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {counters.map((counter) => (
            <div
              key={counter.id}
              className="flex-shrink-0 rounded-2xl border border-foreground/10 bg-surface px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                {nameField(
                  counter,
                  'text-xs w-28',
                  'text-xs font-medium text-foreground/60 uppercase tracking-wide max-w-[7rem]'
                )}
              </div>
              <div className="flex items-center gap-2">
                <StepButton
                  label={`Decrease ${counter.name}`}
                  onClick={() => step(counter, -1)}
                  disabled={counter.value === 0}
                  size="sm"
                >
                  −
                </StepButton>
                <span className="min-w-[2.5rem] text-center text-xl font-mono font-bold text-foreground tabular-nums">
                  {counter.value}
                </span>
                <StepButton
                  label={`Increase ${counter.name}`}
                  onClick={() => step(counter, 1)}
                  size="sm"
                  primary
                >
                  +
                </StepButton>
              </div>
            </div>
          ))}

          <button
            onClick={addCounter}
            disabled={adding}
            className="flex-shrink-0 rounded-2xl border border-dashed border-foreground/20 px-4 text-sm text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            + Counter
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  // ─── Full card, shown on the pattern overview ───
  return (
    <Card className={`p-6 mb-8 ${className}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Stitch Counters</h2>
          <p className="text-sm text-foreground/50">
            Track rows, repeats, or anything else you need to count.
          </p>
        </div>
        <button
          onClick={addCounter}
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-terracotta hover:bg-terracotta-soft rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {adding ? 'Adding...' : 'Add counter'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-foreground/50">Loading counters...</p>
      ) : counters.length === 0 ? (
        <p className="text-sm text-foreground/50 italic">
          No counters yet. Add one to keep track of where you are.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {counters.map((counter) => (
            <div
              key={counter.id}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                {nameField(
                  counter,
                  'text-sm w-full',
                  'text-sm font-medium text-foreground flex-1 min-w-0'
                )}
                <button
                  onClick={() => deleteCounter(counter)}
                  title="Delete counter"
                  aria-label={`Delete ${counter.name}`}
                  className="p-1 text-foreground/30 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <StepButton
                  label={`Decrease ${counter.name}`}
                  onClick={() => step(counter, -1)}
                  disabled={counter.value === 0}
                >
                  −
                </StepButton>
                <span className="flex-1 text-center text-4xl font-mono font-bold text-foreground tabular-nums">
                  {counter.value}
                </span>
                <StepButton label={`Increase ${counter.name}`} onClick={() => step(counter, 1)} primary>
                  +
                </StepButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StepButton({
  children,
  label,
  onClick,
  disabled = false,
  primary = false,
  size = 'md',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  size?: 'sm' | 'md'
}) {
  const sizeStyles = size === 'sm' ? 'w-8 h-8 text-lg' : 'w-11 h-11 text-2xl'
  const colorStyles = primary
    ? 'bg-terracotta text-parchment hover:bg-terracotta-deep'
    : 'bg-foreground/5 text-foreground hover:bg-foreground/10'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex-shrink-0 inline-flex items-center justify-center rounded-full font-semibold leading-none transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta disabled:opacity-40 disabled:cursor-not-allowed ${sizeStyles} ${colorStyles}`}
    >
      {children}
    </button>
  )
}
