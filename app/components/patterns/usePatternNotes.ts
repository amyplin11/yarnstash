'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LinkedPatternCopy, PatternNote } from '@/lib/types/pattern'
import type { NoteTarget } from '@/lib/patterns/note-parts'
import type { NoteUsed } from '@/lib/patterns/note-used'

/**
 * Notes are typed straight into the page, so a write per keystroke would be
 * wasteful: the local copy updates at once and only the last text of a burst
 * is sent, like the stitch counters.
 */
const SAVE_DEBOUNCE_MS = 700

interface PendingWrite {
  target: NoteTarget
  size: string | null
  text: string
  used: NoteUsed | null
}

export interface PatternNotesApi {
  patternId: string
  /** The size being knit, which new notes are written for. */
  size: string | null
  loading: boolean
  error: string | null
  /** Every note: this pattern's, any size, plus its linked copies'. */
  notes: PatternNote[]
  linkedCopies: LinkedPatternCopy[]
  /** The note on this part for the size being knit, if there is one. */
  mine: (partKey: string) => PatternNote | undefined
  /** Notes on this part written for other sizes or on other copies. */
  others: (partKey: string) => PatternNote[]
  /** Notes written for the size being knit, on this copy. */
  mineCount: number
  /**
   * Replace the note on a part for the size being knit. `used` is the "what I
   * used" form; leave it undefined to keep what is there. Empty text and no
   * `used` removes the note.
   */
  setNote: (
    target: NoteTarget,
    partKey: string,
    partLabel: string,
    text: string,
    used?: NoteUsed | null
  ) => void
}

const slot = (size: string | null, partKey: string) => `${size ?? ''}\u0000${partKey}`

export function usePatternNotes(patternId: string, size: string | null): PatternNotesApi {
  const [notes, setNotes] = useState<PatternNote[]>([])
  const [linkedCopies, setLinkedCopies] = useState<LinkedPatternCopy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const notesRef = useRef<PatternNote[]>([])
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingRef = useRef<Map<string, PendingWrite>>(new Map())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`/api/patterns/${patternId}/notes`)
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to load notes')
        if (cancelled) return
        setNotes(result.notes || [])
        setLinkedCopies(result.linkedCopies || [])
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load notes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patternId])

  const send = useCallback(
    (write: PendingWrite, keepalive = false) =>
      fetch(`/api/patterns/${patternId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(write),
        keepalive,
      }),
    [patternId]
  )

  // Leaving the page mid-sentence would otherwise drop the debounced write.
  useEffect(() => {
    const timers = timersRef.current
    const pending = pendingRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      pending.forEach((write) => {
        send(write, true).catch(() => {})
      })
      pending.clear()
    }
  }, [send])

  const flush = useCallback(
    async (key: string) => {
      timersRef.current.delete(key)
      const write = pendingRef.current.get(key)
      pendingRef.current.delete(key)
      if (!write) return
      try {
        const response = await send(write)
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to save note')
        setError(null)
        // Swap the optimistic copy for the stored row (real id, timestamps) —
        // unless more was typed while this was in flight, in which case the
        // local text is newer and the next write will bring the row back.
        if (pendingRef.current.has(key) || !result.note) return
        const saved = result.note as PatternNote
        setNotes((prev) =>
          prev.map((n) =>
            n.pattern_id === saved.pattern_id &&
            (n.size ?? null) === (saved.size ?? null) &&
            n.part_key === saved.part_key
              ? saved
              : n
          )
        )
      } catch {
        setError('Could not save your note — check your connection.')
      }
    },
    [send]
  )

  const setNote = useCallback(
    (target: NoteTarget, partKey: string, partLabel: string, text: string, usedArg?: NoteUsed | null) => {
      const isMine = (n: PatternNote) =>
        n.pattern_id === patternId && (n.size ?? null) === size && n.part_key === partKey

      // Read from the latest render's notes; a text-only edit keeps the form.
      const used = usedArg === undefined ? (notesRef.current.find(isMine)?.used ?? null) : usedArg

      setNotes((prev) => {
        if (!text.trim() && !used) return prev.filter((n) => !isMine(n))
        const existing = prev.find(isMine)
        if (existing) return prev.map((n) => (isMine(n) ? { ...n, note_text: text, used } : n))
        const now = new Date().toISOString()
        return [
          ...prev,
          {
            id: `local-${slot(size, partKey)}`,
            user_id: '',
            pattern_id: patternId,
            size,
            instruction_id: target.kind === 'instruction' ? target.id : null,
            section_id: target.kind === 'section' ? target.id : null,
            material_id: target.kind === 'material' ? target.id : null,
            anchor: target.kind === 'anchor' ? target.anchor : null,
            part_key: partKey,
            part_label: partLabel,
            note_text: text,
            used,
            created_at: now,
            updated_at: now,
          },
        ]
      })

      const key = slot(size, partKey)
      pendingRef.current.set(key, { target, size, text, used })
      const existingTimer = timersRef.current.get(key)
      if (existingTimer) clearTimeout(existingTimer)
      timersRef.current.set(key, setTimeout(() => flush(key), SAVE_DEBOUNCE_MS))
    },
    [patternId, size, flush]
  )

  const mine = useCallback(
    (partKey: string) =>
      notes.find(
        (n) => n.pattern_id === patternId && (n.size ?? null) === size && n.part_key === partKey
      ),
    [notes, patternId, size]
  )

  const others = useCallback(
    (partKey: string) =>
      notes.filter(
        (n) =>
          n.part_key === partKey &&
          !(n.pattern_id === patternId && (n.size ?? null) === size)
      ),
    [notes, patternId, size]
  )

  const mineCount = notes.filter(
    (n) => n.pattern_id === patternId && (n.size ?? null) === size
  ).length

  return { patternId, size, loading, error, notes, linkedCopies, mine, others, mineCount, setNote }
}

/** "For size S" — how a note from another size or copy is introduced. */
export function otherNoteLabel(note: PatternNote, patternId: string): string {
  if (note.size) return `For size ${note.size}`
  return note.pattern_id === patternId ? 'Before a size was chosen' : 'From another copy'
}
