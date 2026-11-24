'use client'

import { useEffect, useRef, useState } from 'react'
import type { NoteTarget } from '@/lib/patterns/note-parts'
import { MAX_NOTE_LENGTH } from '@/lib/patterns/note-parts'
import { usedKindFor } from '@/lib/patterns/note-used'
import { otherNoteLabel, type PatternNotesApi } from './usePatternNotes'
import { UsedNote, type UsedHints } from './UsedNote'

interface PartNoteProps {
  notes: PatternNotesApi
  target: NoteTarget
  partKey: string
  partLabel: string
  /** Show notes on this part from other sizes and copies. Default true. */
  showOthers?: boolean
  /** Words on the add button; "Add note" by default. */
  addLabel?: string
  /** Stretch the add button across its container instead of sizing to its label. */
  addBlock?: boolean
  /** Gauge, needles and yarn: the pattern's values, shown in the "what I used" form. */
  usedHints?: UsedHints
  className?: string
}

/**
 * A note on one part of a pattern. Gauge, needles and yarn get the "what I
 * used" form (UsedNote); every other part gets a free-text note.
 */
export function PartNote(props: PartNoteProps) {
  const kind = usedKindFor(props.target)
  if (kind) {
    return (
      <UsedNote
        notes={props.notes}
        kind={kind}
        target={props.target}
        partKey={props.partKey}
        partLabel={props.partLabel}
        hints={props.usedHints}
        showOthers={props.showOthers}
        className={props.className}
      />
    )
  }
  return <FreeTextNote {...props} />
}

/**
 * The knitter's note on one part of a pattern, for the size being knit.
 *
 * Collapsed to a small "Add note" link until there is something to show, so it
 * can sit under every step and material without crowding the pattern. Typing
 * saves as you go (debounced in usePatternNotes); clearing the text removes
 * the note. Notes from other sizes or copies sit underneath, read-only.
 */
function FreeTextNote({
  notes,
  target,
  partKey,
  partLabel,
  showOthers = true,
  addLabel = 'Add note',
  addBlock = false,
  className = '',
}: PartNoteProps) {
  const mine = notes.mine(partKey)
  const others = showOthers ? notes.others(partKey) : []
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!editing || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  // Grow with the text instead of scrolling inside a tiny box.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing, mine?.note_text])

  if (notes.loading) return null

  return (
    <div className={`text-sm ${className}`}>
      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={mine?.note_text ?? ''}
            maxLength={MAX_NOTE_LENGTH}
            rows={2}
            placeholder={`Note on ${partLabel.toLowerCase() === 'whole pattern' ? 'this pattern' : partLabel}…`}
            onChange={(e) => notes.setNote(target, partKey, partLabel, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full resize-none rounded-lg border border-terracotta/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
          <p className="mt-1 text-xs text-foreground/40">Saves as you type. Clear the text to remove the note.</p>
        </div>
      ) : mine ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex w-full items-start gap-2 rounded-lg border-l-2 border-terracotta bg-terracotta-soft/40 dark:bg-terracotta-deep/15 px-3 py-2 text-left hover:bg-terracotta-soft/70 dark:hover:bg-terracotta-deep/25 transition-colors"
          aria-label={`Edit note on ${partLabel}`}
        >
          <NoteIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-terracotta" />
          <span className="flex-1 whitespace-pre-wrap text-foreground">{mine.note_text}</span>
          <span className="text-xs text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${addBlock ? 'flex w-full justify-center' : 'inline-flex'} items-center gap-1.5 rounded-lg bg-terracotta-soft px-3 py-1.5 text-xs font-medium text-terracotta-deep hover:bg-terracotta/20 active:bg-terracotta/25 transition-colors`}
        >
          <NoteIcon className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      )}

      {others.length > 0 && (
        <ul className="mt-2 space-y-1">
          {others.map((n) => (
            <li key={n.id} className="text-xs text-foreground/55">
              <span className="font-medium text-foreground/65">{otherNoteLabel(n, notes.patternId)}:</span>{' '}
              <span className="whitespace-pre-wrap">{n.note_text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function NoteIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}
