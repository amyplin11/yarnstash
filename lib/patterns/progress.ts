import type { Pattern } from '@/lib/types/pattern'

/**
 * What counts as a project you are currently knitting.
 *
 * One rule, in one place, because the dashboard and the patterns page used to
 * answer this differently and disagree in the UI.
 *
 * A progress row alone is not enough: one is written as soon as a size is
 * picked, so "has progress" also catches patterns that were only ever opened
 * and sized. The project starts when you enter step-by-step mode, which is
 * what sets `current_instruction_id` — and ends when `completed_at` is set.
 */
export function isActiveProject(pattern: Pattern): boolean {
  const progress = pattern.progress
  return !!progress && !progress.completed_at && !!progress.current_instruction_id
}

/** Active projects, most recently worked first. */
export function activeProjects(patterns: Pattern[]): Pattern[] {
  return patterns.filter(isActiveProject).sort(
    (a, b) =>
      new Date(b.progress?.last_worked_at ?? 0).getTime() -
      new Date(a.progress?.last_worked_at ?? 0).getTime()
  )
}
