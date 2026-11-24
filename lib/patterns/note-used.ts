/**
 * "What I used": the knitter's side of the gauge, needles and yarn a pattern
 * calls for. Stored in `pattern_notes.used` next to the free-text note, so a
 * part's note can say both "got 19 sts on 4.5 mm" and "went up a size after
 * the swatch".
 *
 * Shared by the notes API (which validates what it stores) and the pattern
 * page (which renders the form and the summary).
 */

import type { NoteTarget } from './note-parts'

export interface GaugeUsed {
  kind: 'gauge'
  stitches?: string
  rows?: string
  needle?: string
}

export interface NeedleUsed {
  size: string
  usedFor?: string
}

export interface NeedlesUsed {
  kind: 'needles'
  needles: NeedleUsed[]
}

export interface YarnUsed {
  kind: 'yarn'
  yarn?: string
  colorway?: string
  /** How many balls (skeins) of this yarn went into it; halves allowed. */
  balls?: number
}

export type NoteUsed = GaugeUsed | NeedlesUsed | YarnUsed
export type NoteUsedKind = NoteUsed['kind']

export const MAX_USED_FIELD_LENGTH = 120
export const MAX_NEEDLES_USED = 10
export const MAX_BALLS = 999

/** A positive count of balls, rounded to the nearest half; undefined otherwise. */
function cleanBalls(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(Math.round(n * 2) / 2, MAX_BALLS) || undefined
}

/** Which "what I used" form a part gets, if any. */
export function usedKindFor(target: NoteTarget): NoteUsedKind | null {
  if (target.kind === 'material') return 'yarn'
  if (target.kind === 'anchor' && target.anchor === 'gauge') return 'gauge'
  if (target.kind === 'anchor' && target.anchor === 'needles') return 'needles'
  return null
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim().slice(0, MAX_USED_FIELD_LENGTH)
  return v || undefined
}

/**
 * Validates `raw` as the given kind, dropping unknown and empty fields.
 * Returns null when nothing is left, so an emptied form stores nothing.
 */
export function parseUsed(raw: unknown, kind: NoteUsedKind): NoteUsed | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  switch (kind) {
    case 'gauge': {
      const used: GaugeUsed = { kind, stitches: clean(r.stitches), rows: clean(r.rows), needle: clean(r.needle) }
      return used.stitches || used.rows || used.needle ? used : null
    }
    case 'needles': {
      const list = Array.isArray(r.needles) ? r.needles : []
      const needles: NeedleUsed[] = []
      for (const item of list.slice(0, MAX_NEEDLES_USED)) {
        if (!item || typeof item !== 'object') continue
        const n = item as Record<string, unknown>
        const size = clean(n.size)
        const usedFor = clean(n.usedFor)
        if (size || usedFor) needles.push({ size: size ?? '', usedFor })
      }
      return needles.length > 0 ? { kind, needles } : null
    }
    case 'yarn': {
      const used: YarnUsed = { kind, yarn: clean(r.yarn), colorway: clean(r.colorway), balls: cleanBalls(r.balls) }
      return used.yarn || used.colorway || used.balls ? used : null
    }
  }
}

/** Label/value lines for showing a saved "what I used", in form order. */
export function usedLines(used: NoteUsed | null | undefined): { label: string; value: string }[] {
  if (!used) return []
  switch (used.kind) {
    case 'gauge': {
      const lines: { label: string; value: string }[] = []
      const counts = [used.stitches && `${used.stitches} sts`, used.rows && `${used.rows} rows`]
        .filter(Boolean)
        .join(' × ')
      if (counts) lines.push({ label: 'Got', value: `${counts} per 10 cm` })
      if (used.needle) lines.push({ label: 'On', value: used.needle })
      return lines
    }
    case 'needles':
      return used.needles.map((n) => ({ label: n.size || 'Needle', value: n.usedFor ?? '' }))
    case 'yarn': {
      const lines: { label: string; value: string }[] = []
      if (used.yarn) lines.push({ label: 'Yarn', value: used.yarn })
      if (used.colorway) lines.push({ label: 'Colorway', value: used.colorway })
      if (used.balls) lines.push({ label: 'Balls used', value: String(used.balls) })
      return lines
    }
  }
}

/** One line for a read-only mention: "18 sts × 26 rows per 10 cm · On 4.5 mm". */
export function usedSummary(used: NoteUsed | null | undefined): string {
  return usedLines(used)
    .map((l) => (l.value ? `${l.label}: ${l.value}` : l.label))
    .join(' · ')
}
