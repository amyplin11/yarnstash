import { isProjectDifficulty, isProjectStatus } from '@/lib/types'

/**
 * Shared request-body → column mapping for the `/api/projects` routes.
 *
 * Lives outside `app/api/` because a Next route file may only export route
 * handlers and the known config keys — anything else fails the build.
 */

/**
 * Selecting a project plus its yarns in one round trip. RLS on
 * `project_yarns` re-checks ownership through the parent project, so the embed
 * cannot reach another user's rows.
 */
export const PROJECT_SELECT = '*, project_yarns(*)'

/** Scalar text columns a client may set; anything else in the body is ignored. */
const TEXT_FIELDS = [
  'name',
  'pattern',
  'pattern_url',
  'image_url',
  'needle_size',
  'gauge',
  'designer',
  'notes',
  'start_date',
  'end_date',
] as const

export interface ProjectYarnInput {
  stash_yarn_id?: string
  yarn_name: string
  colorway?: string
  skeins_needed?: number
  skeins_used?: number
}

/**
 * Build the column set for an insert or update from a request body.
 *
 * Whitelisted rather than spread, so an unknown key cannot turn into an opaque
 * 500 from PostgREST.
 */
export function columnsFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {}

  for (const field of TEXT_FIELDS) {
    const value = body[field]
    if (typeof value === 'string' && value.trim()) record[field] = value.trim()
  }

  if (isProjectStatus(body.status)) record.status = body.status
  if (isProjectDifficulty(body.difficulty)) record.difficulty = body.difficulty

  const ravelryId = Number(body.ravelry_id)
  if (body.ravelry_id !== undefined && body.ravelry_id !== '' && Number.isFinite(ravelryId)) {
    record.ravelry_id = ravelryId
  }

  if (Array.isArray(body.tags)) {
    record.tags = body.tags
      .filter((t): t is string => typeof t === 'string' && !!t.trim())
      .map((t) => t.trim())
  }

  return record
}

/** Normalise the `yarns` array of a request body into `project_yarns` rows. */
export function yarnRowsFromBody(
  body: Record<string, unknown>,
  projectId: string
): Record<string, unknown>[] {
  if (!Array.isArray(body.yarns)) return []

  return body.yarns
    .filter(
      (y): y is ProjectYarnInput =>
        !!y && typeof y === 'object' && typeof (y as ProjectYarnInput).yarn_name === 'string'
    )
    .filter((y) => y.yarn_name.trim())
    .map((y) => ({
      project_id: projectId,
      stash_yarn_id: typeof y.stash_yarn_id === 'string' ? y.stash_yarn_id : null,
      yarn_name: y.yarn_name.trim(),
      colorway: typeof y.colorway === 'string' && y.colorway.trim() ? y.colorway.trim() : null,
      skeins_needed: Math.max(1, Number(y.skeins_needed) || 1),
      skeins_used: Number.isFinite(Number(y.skeins_used)) ? Number(y.skeins_used) : 0,
    }))
}
