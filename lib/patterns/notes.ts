/**
 * Knitting notes, stored in `pattern_notes`.
 *
 * One table holds three kinds of row, told apart by `instruction_id` and
 * `note_type`:
 *
 * - **Project details** — `instruction_id` null, `note_type` one of the
 *   PROJECT_DETAIL_FIELDS below. At most one row per field: the size you knit,
 *   the yarn and needles you actually used. These are what you look up when
 *   you knit the pattern again or someone asks about the finished piece.
 * - **Project notes** — `instruction_id` null, `note_type` 'general'. Free-form
 *   notes about the project as a whole; as many as you like.
 * - **Step notes** — `instruction_id` set, `note_type` 'general'. Notes tied to
 *   one instruction ("picked up 3 extra sts here"), added as you knit.
 */

export const PROJECT_DETAIL_FIELDS = [
  { type: 'size', label: 'Size knit' },
  { type: 'yarn', label: 'Yarn used' },
  { type: 'needles', label: 'Needles used' },
  { type: 'gauge', label: 'My gauge' },
  { type: 'modifications', label: 'Modifications', multiline: true },
] as const

export type ProjectDetailType = (typeof PROJECT_DETAIL_FIELDS)[number]['type']

export type NoteType = 'general' | ProjectDetailType

export const MAX_NOTE_LENGTH = 2000

const detailTypes = new Set<string>(PROJECT_DETAIL_FIELDS.map((f) => f.type))

export function isProjectDetailType(value: unknown): value is ProjectDetailType {
  return typeof value === 'string' && detailTypes.has(value)
}

export function isNoteType(value: unknown): value is NoteType {
  return value === 'general' || isProjectDetailType(value)
}
