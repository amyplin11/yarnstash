'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PatternNote } from '@/lib/types/pattern'
import type { ProjectDetailType } from '@/lib/patterns/notes'

/**
 * One read of a pattern's notes, shared by the overview's Notes card and the
 * per-step notes. The pattern page owns it so a note added while knitting is
 * already there when you flip back to the overview.
 */
export function usePatternNotes(patternId: string, enabled = true) {
  const [notes, setNotes] = useState<PatternNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/patterns/${patternId}/notes`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Failed to load notes')
      setNotes(result.notes || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [patternId])

  useEffect(() => {
    if (enabled) fetchNotes()
  }, [enabled, fetchNotes])

  /** Replace or append a note returned by the server. */
  const upsertLocal = (note: PatternNote) =>
    setNotes((prev) =>
      prev.some((n) => n.id === note.id)
        ? prev.map((n) => (n.id === note.id ? note : n))
        : [...prev, note]
    )

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/patterns/${patternId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to save note')
        upsertLocal(result.note)
        setError(null)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note')
        return false
      }
    },
    [patternId]
  )

  /** Add a free-form note — to a step when `instructionId` is given, else to the project. */
  const addNote = useCallback(
    (text: string, instructionId?: string) =>
      post({ note_text: text, instruction_id: instructionId ?? null }),
    [post]
  )

  const updateNote = useCallback(
    async (note: PatternNote, text: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/patterns/${patternId}/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_text: text }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to save note')
        upsertLocal(result.note)
        setError(null)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note')
        return false
      }
    },
    [patternId]
  )

  const deleteNote = useCallback(
    async (note: PatternNote): Promise<boolean> => {
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      try {
        const response = await fetch(`/api/patterns/${patternId}/notes/${note.id}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete note')
        setError(null)
        return true
      } catch {
        setError('Could not delete the note.')
        fetchNotes()
        return false
      }
    },
    [patternId, fetchNotes]
  )

  /** Set a project detail; an empty value clears it. */
  const saveDetail = useCallback(
    async (type: ProjectDetailType, value: string): Promise<boolean> => {
      const text = value.trim()
      const existing = notes.find((n) => n.note_type === type && !n.instruction_id)
      if (!text) return existing ? deleteNote(existing) : true
      if (existing?.note_text === text) return true
      return post({ note_text: text, note_type: type })
    },
    [notes, deleteNote, post]
  )

  return { notes, loading, error, addNote, updateNote, deleteNote, saveDetail }
}

export type PatternNotesApi = ReturnType<typeof usePatternNotes>
