'use client'

import { useId, useState } from 'react'
import type { NoteTarget } from '@/lib/patterns/note-parts'
import { MAX_NOTE_LENGTH } from '@/lib/patterns/note-parts'
import {
  MAX_BALLS,
  MAX_NEEDLES_USED,
  MAX_USED_FIELD_LENGTH,
  parseUsed,
  usedLines,
  usedSummary,
  type NeedleUsed,
  type NoteUsed,
  type NoteUsedKind,
} from '@/lib/patterns/note-used'
import { otherNoteLabel, type PatternNotesApi } from './usePatternNotes'

/** The pattern's own values, shown as placeholders so the form reads as "yours vs. theirs". */
export interface UsedHints {
  stitches?: string | number | null
  rows?: string | number | null
  needle?: string | null
  /** Needle sizes the pattern lists, offered as suggestions. */
  needleSizes?: string[]
  yarn?: string | null
}

interface UsedNoteProps {
  notes: PatternNotesApi
  kind: NoteUsedKind
  target: NoteTarget
  partKey: string
  partLabel: string
  hints?: UsedHints
  showOthers?: boolean
  className?: string
}

const COPY: Record<NoteUsedKind, { add: string; title: string }> = {
  gauge: { add: 'Add the gauge you got', title: 'Your gauge' },
  needles: { add: 'Add the needles you used', title: 'Needles you used' },
  yarn: { add: 'Add the yarn you used', title: 'Yarn you used' },
}

interface Draft {
  stitches: string
  rows: string
  needle: string
  needles: NeedleUsed[]
  yarn: string
  colorway: string
  balls: string
  text: string
}

function draftFrom(used: NoteUsed | null | undefined, text: string): Draft {
  return {
    stitches: used?.kind === 'gauge' ? (used.stitches ?? '') : '',
    rows: used?.kind === 'gauge' ? (used.rows ?? '') : '',
    needle: used?.kind === 'gauge' ? (used.needle ?? '') : '',
    needles:
      used?.kind === 'needles' && used.needles.length > 0
        ? used.needles.map((n) => ({ size: n.size, usedFor: n.usedFor ?? '' }))
        : [{ size: '', usedFor: '' }],
    yarn: used?.kind === 'yarn' ? (used.yarn ?? '') : '',
    colorway: used?.kind === 'yarn' ? (used.colorway ?? '') : '',
    balls: used?.kind === 'yarn' && used.balls ? String(used.balls) : '',
    text,
  }
}

/**
 * The knitter's record of what they used for one of the pattern's gauge,
 * needles or yarn — a small form rather than a free-text note, so it reads as
 * the counterpart of what the pattern calls for. A free-text note rides along
 * underneath. Kept per size, like every note; other sizes show beneath.
 */
export function UsedNote({
  notes,
  kind,
  target,
  partKey,
  partLabel,
  hints = {},
  showOthers = true,
  className = '',
}: UsedNoteProps) {
  const mine = notes.mine(partKey)
  const others = showOthers ? notes.others(partKey) : []
  const [draft, setDraft] = useState<Draft | null>(null)
  const listId = useId()

  if (notes.loading) return null

  const copy = COPY[kind]
  const sizeLabel = notes.size ? `Size ${notes.size}` : null
  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = () => {
    if (!draft) return
    const used = parseUsed(
      kind === 'gauge'
        ? { stitches: draft.stitches, rows: draft.rows, needle: draft.needle }
        : kind === 'needles'
          ? { needles: draft.needles }
          : { yarn: draft.yarn, colorway: draft.colorway, balls: draft.balls },
      kind
    )
    notes.setNote(target, partKey, partLabel, draft.text.trim(), used)
    setDraft(null)
  }

  const remove = () => {
    notes.setNote(target, partKey, partLabel, '', null)
    setDraft(null)
  }

  const input =
    'w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/50'
  const label = 'block text-xs font-medium text-foreground/60 mb-1'

  return (
    <div className={`text-sm ${className}`}>
      {draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null)
          }}
          className="rounded-xl border border-terracotta/40 bg-terracotta-soft/25 dark:bg-terracotta-deep/10 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">{copy.title}</p>
            {sizeLabel && <span className="text-xs text-foreground/50">{sizeLabel}</span>}
          </div>

          {kind === 'gauge' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor={`${listId}-sts`}>Stitches per 10 cm</label>
                  <input
                    id={`${listId}-sts`}
                    autoFocus
                    inputMode="decimal"
                    maxLength={MAX_USED_FIELD_LENGTH}
                    value={draft.stitches}
                    onChange={(e) => update({ stitches: e.target.value })}
                    placeholder={hints.stitches ? `Pattern: ${hints.stitches}` : 'e.g. 18'}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label} htmlFor={`${listId}-rows`}>Rows per 10 cm</label>
                  <input
                    id={`${listId}-rows`}
                    inputMode="decimal"
                    maxLength={MAX_USED_FIELD_LENGTH}
                    value={draft.rows}
                    onChange={(e) => update({ rows: e.target.value })}
                    placeholder={hints.rows ? `Pattern: ${hints.rows}` : 'e.g. 26'}
                    className={input}
                  />
                </div>
              </div>
              <div>
                <label className={label} htmlFor={`${listId}-needle`}>On needle</label>
                <input
                  id={`${listId}-needle`}
                  list={hints.needleSizes?.length ? `${listId}-sizes` : undefined}
                  maxLength={MAX_USED_FIELD_LENGTH}
                  value={draft.needle}
                  onChange={(e) => update({ needle: e.target.value })}
                  placeholder={hints.needle ? `Pattern: ${hints.needle}` : 'e.g. 4.5 mm'}
                  className={input}
                />
              </div>
            </>
          )}

          {kind === 'needles' && (
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2 text-xs font-medium text-foreground/60">
                <span>Size</span>
                <span>Used for</span>
                <span className="w-7" />
              </div>
              {draft.needles.map((n, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2 items-center">
                  <input
                    aria-label={`Needle ${i + 1} size`}
                    autoFocus={i === 0}
                    list={hints.needleSizes?.length ? `${listId}-sizes` : undefined}
                    maxLength={MAX_USED_FIELD_LENGTH}
                    value={n.size}
                    onChange={(e) =>
                      update({ needles: draft.needles.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)) })
                    }
                    placeholder={hints.needleSizes?.[i] ?? 'e.g. 4 mm'}
                    className={input}
                  />
                  <input
                    aria-label={`Needle ${i + 1} used for`}
                    maxLength={MAX_USED_FIELD_LENGTH}
                    value={n.usedFor ?? ''}
                    onChange={(e) =>
                      update({ needles: draft.needles.map((x, j) => (j === i ? { ...x, usedFor: e.target.value } : x)) })
                    }
                    placeholder={i === 0 ? 'e.g. body' : 'e.g. hem and cuffs'}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        needles:
                          draft.needles.length > 1
                            ? draft.needles.filter((_, j) => j !== i)
                            : [{ size: '', usedFor: '' }],
                      })
                    }
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/5"
                    aria-label={`Remove needle ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {draft.needles.length < MAX_NEEDLES_USED && (
                <button
                  type="button"
                  onClick={() => update({ needles: [...draft.needles, { size: '', usedFor: '' }] })}
                  className="text-xs font-medium text-terracotta hover:text-terracotta-deep"
                >
                  + Add another needle
                </button>
              )}
            </div>
          )}

          {kind === 'yarn' && (
            <>
              <div>
                <label className={label} htmlFor={`${listId}-yarn`}>Yarn</label>
                <input
                  id={`${listId}-yarn`}
                  autoFocus
                  maxLength={MAX_USED_FIELD_LENGTH}
                  value={draft.yarn}
                  onChange={(e) => update({ yarn: e.target.value })}
                  placeholder={hints.yarn ? `Pattern: ${hints.yarn}` : 'Brand and yarn name'}
                  className={input}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor={`${listId}-color`}>Colorway</label>
                  <input
                    id={`${listId}-color`}
                    maxLength={MAX_USED_FIELD_LENGTH}
                    value={draft.colorway}
                    onChange={(e) => update({ colorway: e.target.value })}
                    placeholder="e.g. Rust"
                    className={input}
                  />
                </div>
                <div>
                  <label className={label} htmlFor={`${listId}-balls`}>Balls used</label>
                  <input
                    id={`${listId}-balls`}
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    max={MAX_BALLS}
                    step={0.5}
                    value={draft.balls}
                    onChange={(e) => update({ balls: e.target.value })}
                    placeholder="e.g. 5"
                    className={input}
                  />
                </div>
              </div>
            </>
          )}

          {hints.needleSizes && hints.needleSizes.length > 0 && (
            <datalist id={`${listId}-sizes`}>
              {[...new Set(hints.needleSizes)].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}

          <div>
            <label className={label} htmlFor={`${listId}-text`}>Notes</label>
            <textarea
              id={`${listId}-text`}
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              value={draft.text}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="Anything else worth remembering"
              className={`${input} resize-y`}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="rounded-lg bg-terracotta px-4 py-1.5 text-sm font-medium text-white hover:bg-terracotta-deep transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
            {mine && (
              <button
                type="button"
                onClick={remove}
                className="ml-auto text-xs text-foreground/45 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </form>
      ) : mine ? (
        <SavedUsed
          title={copy.title}
          sizeLabel={sizeLabel}
          used={mine.used}
          text={mine.note_text}
          onEdit={() => setDraft(draftFrom(mine.used, mine.note_text))}
        />
      ) : (
        <button
          type="button"
          onClick={() => setDraft(draftFrom(null, ''))}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-terracotta/45 px-3 py-2.5 text-sm font-medium text-terracotta hover:bg-terracotta-soft/40 dark:hover:bg-terracotta-deep/15 hover:border-terracotta transition-colors"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          {copy.add}
        </button>
      )}

      {others.length > 0 && (
        <ul className="mt-2 space-y-1">
          {others.map((n) => {
            const summary = usedSummary(n.used)
            return (
              <li key={n.id} className="text-xs text-foreground/55">
                <span className="font-medium text-foreground/65">{otherNoteLabel(n, notes.patternId)}:</span>{' '}
                {summary}
                {summary && n.note_text ? ' — ' : ''}
                <span className="whitespace-pre-wrap">{n.note_text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SavedUsed({
  title,
  sizeLabel,
  used,
  text,
  onEdit,
}: {
  title: string
  sizeLabel: string | null
  used: NoteUsed | null
  text: string
  onEdit: () => void
}) {
  const lines = usedLines(used)
  return (
    <div className="rounded-xl border border-terracotta/35 bg-terracotta-soft/35 dark:bg-terracotta-deep/15 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
          {title}
          {sizeLabel && <span className="ml-1.5 font-normal normal-case tracking-normal text-foreground/50">· {sizeLabel}</span>}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-terracotta hover:text-terracotta-deep transition-colors"
        >
          Edit
        </button>
      </div>
      {lines.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {lines.map((l, i) => (
            <div key={i} className="contents">
              <dt className="text-foreground/55">{l.label}</dt>
              <dd className="text-foreground">{l.value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {text && (
        <p className={`whitespace-pre-wrap text-foreground/80 ${lines.length > 0 ? 'mt-2' : ''}`}>{text}</p>
      )}
    </div>
  )
}
