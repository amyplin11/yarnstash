export const PROJECT_STATUSES = ['queued', 'in-progress', 'completed', 'frogged'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_DIFFICULTIES = ['beginner', 'easy', 'intermediate', 'advanced'] as const
export type ProjectDifficulty = (typeof PROJECT_DIFFICULTIES)[number]

export interface Project {
  id: string
  name: string
  pattern: string
  patternUrl?: string
  imageUrl?: string
  status: ProjectStatus
  needleSize?: string
  gauge?: string
  yarn: YarnInProject[]
  notes?: string
  startDate?: Date
  endDate?: Date
  tags?: string[]
  difficulty?: ProjectDifficulty
  // Ravelry-specific fields for Phase 3
  ravelryId?: number
  designer?: string
}

export interface YarnInProject {
  yarnId: string
  yarnName: string
  colorway: string
  skeinsNeeded: number
  skeinsUsed?: number
}

// === Database row shapes (Supabase `projects` / `project_yarns`) ===

export interface ProjectYarnRow {
  id: string
  project_id: string | null
  stash_yarn_id: string | null
  yarn_name: string
  colorway: string | null
  skeins_needed: number
  skeins_used: number | null
  created_at: string | null
}

export interface ProjectRow {
  id: string
  user_id: string | null
  name: string
  pattern: string
  pattern_url: string | null
  image_url: string | null
  status: string
  needle_size: string | null
  gauge: string | null
  difficulty: string | null
  designer: string | null
  ravelry_id: number | null
  notes: string | null
  tags: string[] | null
  start_date: string | null
  end_date: string | null
  created_at: string | null
  updated_at: string | null
  /** Present only when the row was selected with the `project_yarns(*)` embed. */
  project_yarns?: ProjectYarnRow[]
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus)
}

export function isProjectDifficulty(value: unknown): value is ProjectDifficulty {
  return PROJECT_DIFFICULTIES.includes(value as ProjectDifficulty)
}

/**
 * `start_date`/`end_date` are Postgres `date` columns, so they arrive as bare
 * `YYYY-MM-DD`. `new Date('2024-11-15')` reads that as UTC midnight, which
 * renders as the 14th anywhere west of Greenwich — so build the date from its
 * parts and keep it local.
 */
function parseDateOnly(value: string | null): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

// === Conversion: ProjectRow -> Project (for existing UI components) ===

export function projectRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    patternUrl: row.pattern_url || undefined,
    imageUrl: row.image_url || undefined,
    // `status` and `difficulty` are plain text columns with no check
    // constraint, so narrow them here rather than trusting the row.
    status: isProjectStatus(row.status) ? row.status : 'queued',
    needleSize: row.needle_size || undefined,
    gauge: row.gauge || undefined,
    yarn: (row.project_yarns ?? []).map((y) => ({
      yarnId: y.stash_yarn_id || y.id,
      yarnName: y.yarn_name,
      colorway: y.colorway || '',
      skeinsNeeded: y.skeins_needed,
      skeinsUsed: y.skeins_used ?? undefined,
    })),
    notes: row.notes || undefined,
    startDate: parseDateOnly(row.start_date),
    endDate: parseDateOnly(row.end_date),
    tags: row.tags?.length ? row.tags : undefined,
    difficulty: isProjectDifficulty(row.difficulty) ? row.difficulty : undefined,
    ravelryId: row.ravelry_id ?? undefined,
    designer: row.designer || undefined,
  }
}
