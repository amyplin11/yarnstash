'use client'

import { useState } from 'react'
import { Card } from '@/app/components/ui/Card'
import type { PatternNote } from '@/lib/types/pattern'
import {
  MAX_NOTE_LENGTH,
  PROJECT_DETAIL_FIELDS,
  type ProjectDetailType,
} from '@/lib/patterns/notes'
import type { PatternNotesApi } from './usePatternNotes'

// ─── Notes card on the pattern overview ───

interface ProjectNotesCardProps {
  api: PatternNotesApi
  /** What the pattern calls for, offered as a one-tap fill for empty details. */
  suggestions?: Partial<Record<ProjectDetailType, string>>
  /** instruction id → "Body · Row 12", in pattern order. Orders the step notes. */
  stepLabels: Map<string, string>
  className?: string
}

export function ProjectNotesCard({
  api,
  suggestions = {},
  stepLabels,
  className = '',
}: ProjectNotesCardProps) {
  const { notes, loading, error } = api

  const detailFor = (type: ProjectDetailType) =>
    notes.find((n) => n.note_type === type && !n.instruction_id)
  const projectNotes = notes.filter((n) => !n.instruction_id && n.note_type === 'general')

  // Group step notes under their step, in the order the steps are knitted.
  // Notes on a step that is no longer in the pattern are dropped from view
  // rather than shown under a label we cannot produce.
  const stepGroups: Array<{ instructionId: string; label: string; notes: PatternNote[] }> = []
  for (const [instructionId, label] of stepLabels) {
    const forStep = notes.filter((n) => n.instruction_id === instructionId)
    if (forStep.length > 0) stepGroups.push({ instructionId, label, notes: forStep })
  }

  return (
    <Card className={`p-6 mb-8 ${className}`}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Notes</h2>
        <p className="text-sm text-foreground/50">
          Your record of this project — add to it as you knit.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-foreground/50">Loading notes...</p>
      ) : (
        <div className="space-y-8">
          {/* Project — the details you'd want if you knit this again */}
          <section>
            <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
              Project
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {PROJECT_DETAIL_FIELDS.map((field) => (
                <DetailField
                  key={field.type}
                  label={field.label}
                  multiline={'multiline' in field && field.multiline}
                  value={detailFor(field.type)?.note_text ?? ''}
                  suggestion={suggestions[field.type]}
                  onSave={(value) => api.saveDetail(field.type, value)}
                />
              ))}
            </div>

            {projectNotes.length > 0 && (
              <ul className="space-y-2 mb-3">
                {projectNotes.map((note) => (
                  <NoteItem key={note.id} note={note} api={api} />
                ))}
              </ul>
            )}
            <AddNoteForm
              placeholder="Add a note about the project..."
              onAdd={(text) => api.addNote(text)}
            />
          </section>

          {/* Step notes — everything jotted against a specific instruction */}
          <section>
            <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
              Step notes
            </h3>
            {stepGroups.length === 0 ? (
              <p className="text-sm text-foreground/50 italic">
                No step notes yet. Add one to any instruction below, or while knitting step by
                step.
              </p>
            ) : (
              <div className="space-y-4">
                {stepGroups.map((group) => (
                  <div key={group.instructionId}>
                    <p className="text-xs font-mono font-medium text-terracotta mb-1.5">
                      {group.label}
                    </p>
                    <ul className="space-y-2">
                      {group.notes.map((note) => (
                        <NoteItem key={note.id} note={note} api={api} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Card>
  )
}

// ─── Notes on one instruction ───

interface StepNotesProps {
  api: PatternNotesApi
  instructionId: string
  /** 'inline' sits under a step in the overview list; 'follow' is the card while knitting. */
  variant?: 'inline' | 'follow'
  className?: string
}

export function StepNotes({ api, instructionId, variant = 'inline', className = '' }: StepNotesProps) {
  const stepNotes = api.notes.filter((n) => n.instruction_id === instructionId)

  if (variant === 'follow') {
    return (
      <Card className={`p-5 ${className}`}>
        <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
          Your notes for this step
        </h3>
        {stepNotes.length > 0 && (
          <ul className="space-y-2 mb-3">
            {stepNotes.map((note) => (
              <NoteItem key={note.id} note={note} api={api} />
            ))}
          </ul>
        )}
        {/* Keyed by step so a half-typed note doesn't follow you to the next one. */}
        <AddNoteForm
          key={instructionId}
          placeholder="Jot down a change, a stitch count, a reminder..."
          onAdd={(text) => api.addNote(text, instructionId)}
        />
        {api.error && <p className="text-xs text-red-600 mt-2">{api.error}</p>}
      </Card>
    )
  }

  return (
    <div className={className}>
      {stepNotes.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {stepNotes.map((note) => (
            <NoteItem key={note.id} note={note} api={api} compact />
          ))}
        </ul>
      )}
      <AddNoteForm
        placeholder="Add a note to this step..."
        onAdd={(text) => api.addNote(text, instructionId)}
        collapsed
      />
    </div>
  )
}

// ─── Pieces ───

function DetailField({
  label,
  value,
  suggestion,
  multiline = false,
  onSave,
}: {
  label: string
  value: string
  suggestion?: string
  multiline?: boolean
  onSave: (value: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const start = () => {
    setDraft(value)
    setEditing(true)
  }

  const commit = async (next: string) => {
    setEditing(false)
    if (next.trim() === value) return
    setSaving(true)
    await onSave(next)
    setSaving(false)
  }

  const inputClass =
    'w-full bg-surface border border-terracotta/40 rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40'

  return (
    <div
      className={`rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3.5 py-3 ${
        multiline ? 'sm:col-span-2' : ''
      }`}
    >
      <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">{label}</p>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            rows={3}
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={suggestion}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                commit(draft)
              }
            }}
            className={`${inputClass} resize-y`}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={suggestion}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(draft)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              }
            }}
            className={inputClass}
          />
        )
      ) : (
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={start}
            title={`Edit ${label.toLowerCase()}`}
            className={`flex-1 min-w-0 text-left text-sm rounded-lg px-1.5 py-0.5 -mx-1.5 hover:bg-foreground/5 transition-colors whitespace-pre-wrap ${
              value ? 'text-foreground' : 'text-foreground/40 italic'
            } ${saving ? 'opacity-50' : ''}`}
          >
            {value || 'Add...'}
          </button>
          {!value && suggestion && (
            <button
              type="button"
              onClick={() => commit(suggestion)}
              title="Use what the pattern calls for"
              className="flex-shrink-0 max-w-[55%] truncate text-xs text-terracotta hover:bg-terracotta-soft rounded-md px-1.5 py-0.5 transition-colors"
            >
              Use {suggestion}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NoteItem({
  note,
  api,
  compact = false,
}: {
  note: PatternNote
  api: PatternNotesApi
  compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.note_text)

  const save = async () => {
    const text = draft.trim()
    if (!text) return
    if (text === note.note_text) {
      setEditing(false)
      return
    }
    if (await api.updateNote(note, text)) setEditing(false)
  }

  const remove = () => {
    if (!confirm('Delete this note?')) return
    api.deleteNote(note)
  }

  const textClass = compact ? 'text-xs' : 'text-sm'

  if (editing) {
    return (
      <li>
        <textarea
          autoFocus
          rows={2}
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          aria-label="Edit note"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(note.note_text)
              setEditing(false)
            }
          }}
          className={`w-full bg-surface border border-terracotta/40 rounded-lg px-2.5 py-1.5 ${textClass} text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 resize-y`}
        />
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={save}
            disabled={!draft.trim()}
            className="text-xs font-medium text-terracotta hover:underline disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(note.note_text)
              setEditing(false)
            }}
            className="text-xs text-foreground/50 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li
      className={`group flex items-start gap-3 border-l-2 border-terracotta/40 ${
        compact ? 'pl-2.5' : 'pl-3 py-0.5'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`${textClass} text-foreground whitespace-pre-wrap break-words`}>
          {note.note_text}
        </p>
        <p className="text-[11px] text-foreground/40 mt-0.5">{formatNoteDate(note)}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            setDraft(note.note_text)
            setEditing(true)
          }}
          aria-label="Edit note"
          title="Edit note"
          className="p-1 text-foreground/40 hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1.464-4.536z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label="Delete note"
          title="Delete note"
          className="p-1 text-foreground/40 hover:text-red-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </li>
  )
}

function AddNoteForm({
  placeholder,
  onAdd,
  collapsed = false,
}: {
  placeholder: string
  onAdd: (text: string) => Promise<boolean>
  /** Show only a "+ Note" link until clicked — for places with many of these. */
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(!collapsed)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    const ok = await onAdd(text)
    setSaving(false)
    if (ok) {
      setDraft('')
      if (collapsed) setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs text-foreground/40 hover:text-terracotta transition-colors"
      >
        + Note
      </button>
    )
  }

  return (
    <div className={`flex items-end gap-2 ${collapsed ? 'mt-2' : ''}`}>
      <textarea
        autoFocus={collapsed}
        rows={collapsed ? 1 : 2}
        value={draft}
        maxLength={MAX_NOTE_LENGTH}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter saves, like a chat box; Shift+Enter for a new line.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape' && collapsed) {
            e.preventDefault()
            setDraft('')
            setOpen(false)
          }
        }}
        className="flex-1 bg-surface border border-foreground/15 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/40 resize-y"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!draft.trim() || saving}
        className="flex-shrink-0 px-3 py-2 rounded-lg bg-terracotta text-parchment text-sm font-medium hover:bg-terracotta-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Add'}
      </button>
    </div>
  )
}

function formatNoteDate(note: PatternNote): string {
  const created = new Date(note.created_at)
  const sameYear = created.getFullYear() === new Date().getFullYear()
  const label = created.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  // A minute's grace so the insert itself doesn't read as an edit.
  const edited =
    note.updated_at && new Date(note.updated_at).getTime() - created.getTime() > 60_000
  return edited ? `${label} · edited` : label
}
