'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import type { NotePart } from '@/lib/patterns/note-parts'
import type { PatternNote } from '@/lib/types/pattern'
import { usedSummary } from '@/lib/patterns/note-used'
import { PartNote } from './PartNote'
import { otherNoteLabel, type PatternNotesApi } from './usePatternNotes'

interface AllNotesViewProps {
  patternName: string
  size: string | null
  /** Every part of the pattern in reading order, from listNoteParts(). */
  parts: NotePart[]
  notes: PatternNotesApi
  onBack: () => void
  /** Open follow-along mode at this step. */
  onGoToStep: (instructionId: string) => void
}

/**
 * Every note on a pattern for the size being knit, in the order the pattern
 * reads: the pattern as a whole, then gauge, needles, materials and notions,
 * then each section and its steps. Notes stay editable here.
 *
 * "Show other sizes" adds notes written for other sizes — on this copy, or on
 * another upload of the same PDF. Those whose part has no match in this copy
 * (the two extractions split a section differently, say) are listed at the
 * end under the label they were written with.
 */
export function AllNotesView({ patternName, size, parts, notes, onBack, onGoToStep }: AllNotesViewProps) {
  const [showOthers, setShowOthers] = useState(true)
  // Parts edited in this view stay listed, so clearing a note's text while
  // typing doesn't make the field vanish under the cursor.
  const [edited, setEdited] = useState<Set<string>>(() => new Set())
  const viewNotes = useMemo<PatternNotesApi>(
    () => ({
      ...notes,
      setNote: (target, partKey, partLabel, text, used) => {
        setEdited((prev) => (prev.has(partKey) ? prev : new Set(prev).add(partKey)))
        notes.setNote(target, partKey, partLabel, text, used)
      },
    }),
    [notes]
  )

  const otherSizesCount = useMemo(
    () =>
      notes.notes.filter(
        (n) => !(n.pattern_id === notes.patternId && (n.size ?? null) === size)
      ).length,
    [notes.notes, notes.patternId, size]
  )

  const knownKeys = useMemo(() => new Set(parts.map((p) => p.key)), [parts])
  const unmatched = useMemo(
    () => (showOthers ? notes.notes.filter((n) => !knownKeys.has(n.part_key)) : []),
    [showOthers, notes.notes, knownKeys]
  )

  const hasContent = (part: NotePart) =>
    edited.has(part.key) ||
    Boolean(notes.mine(part.key)) ||
    (showOthers && notes.others(part.key).length > 0)

  const wholePattern = parts.find((p) => p.group === 'pattern')
  const materials = parts.filter((p) => p.group === 'materials' && hasContent(p))

  // Group section and step parts by section, keeping only sections with notes.
  const sections = useMemo(() => {
    const groups: { section: NotePart; items: NotePart[] }[] = []
    for (const part of parts) {
      if (part.group !== 'section') continue
      if (part.target.kind === 'section') groups.push({ section: part, items: [] })
      else groups[groups.length - 1]?.items.push(part)
    }
    return groups
  }, [parts])
  const visibleSections = sections
    .map((g) => ({
      section: g.section,
      showSectionNote: hasContent(g.section),
      items: g.items.filter(hasContent),
    }))
    .filter((g) => g.showSectionNote || g.items.length > 0)

  const nothingYet = notes.mineCount === 0 && !(showOthers && otherSizesCount > 0)

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Overview
          </button>
          <p className="text-sm text-foreground/50 truncate ml-4">{patternName}</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-tight text-ink">All notes</h1>
            <div className="mt-2 flex items-center gap-2">
              {size ? <Badge text={`Size ${size}`} variant="primary" /> : (
                <span className="text-sm text-foreground/50">No size chosen</span>
              )}
              <span className="text-sm text-foreground/50">
                {notes.mineCount} {notes.mineCount === 1 ? 'note' : 'notes'}
              </span>
            </div>
          </div>
          {otherSizesCount > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-foreground/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOthers}
                onChange={(e) => setShowOthers(e.target.checked)}
                className="h-4 w-4 accent-terracotta"
              />
              Show other sizes ({otherSizesCount})
            </label>
          )}
        </div>

        {notes.error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{notes.error}</p>
        )}

        <div className="space-y-4">
          {wholePattern && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
                Whole pattern
              </h2>
              <PartNote
                notes={viewNotes}
                target={wholePattern.target}
                partKey={wholePattern.key}
                partLabel={wholePattern.label}
                showOthers={showOthers}
                addLabel="Add a note about the whole pattern"
              />
            </Card>
          )}

          {materials.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
                Materials &amp; tools
              </h2>
              <div className="divide-y divide-foreground/10">
                {materials.map((part) => (
                  <NoteRow key={part.key} part={part} notes={viewNotes} showOthers={showOthers} />
                ))}
              </div>
            </Card>
          )}

          {visibleSections.map(({ section, showSectionNote, items }) => (
            <Card key={section.key} className="p-5">
              <h2 className="font-semibold text-foreground mb-3">{section.label}</h2>
              {showSectionNote && (
                <PartNote
                  notes={viewNotes}
                  target={section.target}
                  partKey={section.key}
                  partLabel={section.label}
                  showOthers={showOthers}
                  className="mb-3"
                />
              )}
              {items.length > 0 && (
                <div className="divide-y divide-foreground/10">
                  {items.map((part) => (
                    <NoteRow
                      key={part.key}
                      part={part}
                      label={part.label.slice(section.label.length + ' · '.length)}
                      notes={viewNotes}
                      showOthers={showOthers}
                      onGoToStep={part.instructionId ? () => onGoToStep(part.instructionId!) : undefined}
                    />
                  ))}
                </div>
              )}
            </Card>
          ))}

          {unmatched.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-1">
                From other copies
              </h2>
              <p className="text-xs text-foreground/50 mb-3">
                Written on another upload of this pattern, on a part this copy doesn&apos;t have.
              </p>
              <ul className="space-y-2">
                {unmatched.map((n) => (
                  <UnmatchedNote key={n.id} note={n} patternId={notes.patternId} />
                ))}
              </ul>
            </Card>
          )}

          {nothingYet && (
            <p className="text-sm text-foreground/50 text-center py-6">
              No notes {size ? `for size ${size} ` : ''}yet. Add one under any step, material, needle
              or section on the overview, or while you knit.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function NoteRow({
  part,
  label,
  notes,
  showOthers,
  onGoToStep,
}: {
  part: NotePart
  label?: string
  notes: PatternNotesApi
  showOthers: boolean
  onGoToStep?: () => void
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-foreground/80">{label ?? part.label}</p>
        {onGoToStep && (
          <button
            type="button"
            onClick={onGoToStep}
            className="text-xs text-terracotta hover:text-terracotta-deep transition-colors flex-shrink-0"
          >
            Go to step →
          </button>
        )}
      </div>
      <PartNote
        notes={notes}
        target={part.target}
        partKey={part.key}
        partLabel={part.label}
        showOthers={showOthers}
      />
    </div>
  )
}

function UnmatchedNote({ note, patternId }: { note: PatternNote; patternId: string }) {
  return (
    <li className="text-sm">
      <p className="text-xs text-foreground/50">
        {otherNoteLabel(note, patternId)} · {note.part_label ?? 'Unknown part'}
      </p>
      {note.used && <p className="text-foreground/80">{usedSummary(note.used)}</p>}
      {note.note_text && <p className="whitespace-pre-wrap text-foreground/80">{note.note_text}</p>}
    </li>
  )
}
