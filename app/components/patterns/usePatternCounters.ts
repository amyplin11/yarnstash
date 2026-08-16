'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PatternCounter } from '@/lib/types/pattern'

/**
 * Counting happens a stitch at a time, so every tap must feel instant: the
 * displayed value updates locally and the write is debounced. Only the last
 * value of a burst reaches the server.
 */
const SAVE_DEBOUNCE_MS = 600

export interface UsePatternCounters {
  counters: PatternCounter[]
  loading: boolean
  error: string | null
  /** True when the pattern_counters table has not been migrated yet. */
  setupRequired: boolean
  adding: boolean
  /** Bump a counter by delta, clamped at zero. Optimistic; the write is debounced. */
  step: (counter: PatternCounter, delta: number) => void
  /** Create a counter, optionally pinned to an instruction. Returns it, or null on failure. */
  addCounter: (options?: { name?: string; instructionId?: string | null }) => Promise<PatternCounter | null>
  renameCounter: (counter: PatternCounter, name: string) => Promise<void>
  deleteCounter: (counter: PatternCounter) => Promise<void>
  /** Move a counter between a step and the whole pattern. */
  reassignCounter: (counter: PatternCounter, instructionId: string | null) => Promise<void>
  refetch: () => Promise<void>
}

export function usePatternCounters(patternId: string): UsePatternCounters {
  const [counters, setCounters] = useState<PatternCounter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [adding, setAdding] = useState(false)

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingRef = useRef<Map<string, number>>(new Map())

  const refetch = useCallback(async () => {
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
    refetch()
  }, [refetch])

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
      setCounters((prev) => prev.map((c) => (c.id === counter.id ? { ...c, value: next } : c)))
      queueSave(counter.id, next)
    },
    [queueSave]
  )

  const addCounter = useCallback(
    async (options?: { name?: string; instructionId?: string | null }) => {
      setAdding(true)
      try {
        const response = await fetch(`/api/patterns/${patternId}/counters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: options?.name,
            instruction_id: options?.instructionId ?? null,
          }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (result.setupRequired) {
            setSetupRequired(true)
            return null
          }
          throw new Error(result.error || 'Failed to add counter')
        }
        setCounters((prev) => [...prev, result.counter])
        setError(null)
        return result.counter as PatternCounter
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add counter')
        return null
      } finally {
        setAdding(false)
      }
    },
    [patternId]
  )

  const renameCounter = useCallback(
    async (counter: PatternCounter, rawName: string) => {
      const name = rawName.trim()
      if (!name || name === counter.name) return

      const previousName = counter.name
      setCounters((prev) => prev.map((c) => (c.id === counter.id ? { ...c, name } : c)))
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
    [patternId]
  )

  const reassignCounter = useCallback(
    async (counter: PatternCounter, instructionId: string | null) => {
      const previous = counter.instruction_id
      if (previous === instructionId) return

      setCounters((prev) =>
        prev.map((c) => (c.id === counter.id ? { ...c, instruction_id: instructionId } : c))
      )
      try {
        const response = await fetch(`/api/patterns/${patternId}/counters/${counter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction_id: instructionId }),
        })
        if (!response.ok) throw new Error('Failed to move counter')
        setError(null)
      } catch {
        setCounters((prev) =>
          prev.map((c) => (c.id === counter.id ? { ...c, instruction_id: previous } : c))
        )
        setError('Could not move the counter.')
      }
    },
    [patternId]
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
        refetch()
      }
    },
    [patternId, refetch]
  )

  return {
    counters,
    loading,
    error,
    setupRequired,
    adding,
    step,
    addCounter,
    renameCounter,
    deleteCounter,
    reassignCounter,
    refetch,
  }
}
