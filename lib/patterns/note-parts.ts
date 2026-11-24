/**
 * The parts of a pattern a knitter can write a note on, and the keys that name
 * them.
 *
 * A note is stored against row ids (instruction_id, section_id, material_id) so
 * it cascades away with its pattern, but it also carries a `part_key` that does
 * not depend on those ids. A pattern extracted for one size is its own
 * `patterns` row: knitting the M after the S means a second upload with fresh
 * ids. The key is how a note written on the S copy is found on the M copy.
 *
 * Keys are built from what the two extractions should agree on — section names
 * and per-section step numbers — so cross-copy matching is best-effort. A note
 * whose key has no match is still shown, under its saved `part_label`.
 *
 * Shared by the notes API (which computes the key it stores) and the pattern
 * page (which computes the same key to find a part's notes).
 */

export const NOTE_ANCHORS = ['gauge', 'needles', 'notions'] as const
export type NoteAnchor = (typeof NOTE_ANCHORS)[number]

export const ANCHOR_LABELS: Record<NoteAnchor, string> = {
  gauge: 'Gauge',
  needles: 'Needles',
  notions: 'Notions',
}

export function isNoteAnchor(value: unknown): value is NoteAnchor {
  return typeof value === 'string' && (NOTE_ANCHORS as readonly string[]).includes(value)
}

/** What a note is attached to. `pattern` means the pattern as a whole. */
export type NoteTarget =
  | { kind: 'pattern' }
  | { kind: 'anchor'; anchor: NoteAnchor }
  | { kind: 'section'; id: string }
  | { kind: 'material'; id: string }
  | { kind: 'instruction'; id: string }

export const PATTERN_PART_KEY = 'pattern'
export const PATTERN_PART_LABEL = 'Whole pattern'

export const MAX_NOTE_LENGTH = 2000
export const MAX_SIZE_LENGTH = 40

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

interface SectionLike {
  id: string
  section_name: string
  section_order: number
}

/**
 * Keys every section. Two sections can share a name ("Sleeve" for each arm),
 * so the key counts occurrences: the first "Sleeve" is `sleeve#1`, the
 * second `sleeve#2`.
 */
export function sectionKeys(sections: SectionLike[]): Map<string, { key: string; label: string }> {
  const seen = new Map<string, number>()
  const result = new Map<string, { key: string; label: string }>()
  const ordered = [...sections].sort((a, b) => a.section_order - b.section_order)
  for (const section of ordered) {
    const name = normalize(section.section_name) || 'section'
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    result.set(section.id, { key: `section:${name}#${n}`, label: section.section_name })
  }
  return result
}

/** Step numbers restart in every section, so a step is keyed under its section. */
export function stepKey(sectionKey: string, stepNumber: number): string {
  return `step:${sectionKey.slice('section:'.length)}/${stepNumber}`
}

export function stepLabel(sectionName: string, stepNumber: number): string {
  return `${sectionName} · Step ${stepNumber}`
}

interface MaterialLike {
  yarn_brand?: string | null
  yarn_name?: string | null
  color_name?: string | null
}

export function materialKey(material: MaterialLike): string {
  const yarn = normalize([material.yarn_brand, material.yarn_name].filter(Boolean).join(' '))
  return `material:${normalize(material.color_name)}|${yarn}`
}

export function materialLabel(material: MaterialLike): string {
  const yarn = [material.yarn_brand, material.yarn_name].filter(Boolean).join(' ') || 'Yarn'
  return material.color_name ? `${material.color_name}: ${yarn}` : yarn
}

// === The ordered list of parts, for the "All notes" view ===

export type NotePartGroup = 'pattern' | 'materials' | 'section'

export interface NotePart {
  key: string
  label: string
  target: NoteTarget
  group: NotePartGroup
  /** For section and step parts: the section they belong to. */
  sectionId?: string
  /** For step parts: the instruction's id, so the view can jump to it. */
  instructionId?: string
}

interface PatternShape {
  details: {
    gauge_stitches?: number | null
    gauge_rows?: number | null
    needles?: unknown[] | null
    notions?: unknown[] | null
  } | null
  materials: Array<MaterialLike & { id: string }>
  sections: Array<
    SectionLike & {
      section_type?: string | null
      instructions: Array<{ id: string; step_number: number }>
    }
  >
}

/** Every part of a pattern, in the order the pattern reads. */
export function listNoteParts(data: PatternShape): NotePart[] {
  const parts: NotePart[] = [
    { key: PATTERN_PART_KEY, label: PATTERN_PART_LABEL, target: { kind: 'pattern' }, group: 'pattern' },
  ]

  const { details } = data
  if (details?.gauge_stitches || details?.gauge_rows) {
    parts.push({ key: 'gauge', label: ANCHOR_LABELS.gauge, target: { kind: 'anchor', anchor: 'gauge' }, group: 'materials' })
  }
  if (details?.needles && details.needles.length > 0) {
    parts.push({ key: 'needles', label: ANCHOR_LABELS.needles, target: { kind: 'anchor', anchor: 'needles' }, group: 'materials' })
  }
  for (const material of data.materials) {
    parts.push({
      key: materialKey(material),
      label: materialLabel(material),
      target: { kind: 'material', id: material.id },
      group: 'materials',
    })
  }
  if (details?.notions && details.notions.length > 0) {
    parts.push({ key: 'notions', label: ANCHOR_LABELS.notions, target: { kind: 'anchor', anchor: 'notions' }, group: 'materials' })
  }

  const keys = sectionKeys(data.sections)
  const ordered = [...data.sections].sort((a, b) => a.section_order - b.section_order)
  for (const section of ordered) {
    const sk = keys.get(section.id)!
    parts.push({
      key: sk.key,
      label: sk.label,
      target: { kind: 'section', id: section.id },
      group: 'section',
      sectionId: section.id,
    })
    for (const instruction of section.instructions) {
      parts.push({
        key: stepKey(sk.key, instruction.step_number),
        label: stepLabel(section.section_name, instruction.step_number),
        target: { kind: 'instruction', id: instruction.id },
        group: 'section',
        sectionId: section.id,
        instructionId: instruction.id,
      })
    }
  }

  return parts
}
