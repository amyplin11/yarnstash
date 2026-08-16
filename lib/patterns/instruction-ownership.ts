import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether an instruction really belongs to the given pattern.
 *
 * `pattern_instructions` carries no `pattern_id` — it hangs off
 * `pattern_sections`, which is the table that knows the pattern. So this is a
 * two-hop check, and it matters: without it a caller could pin a counter to an
 * instruction id from someone else's pattern, and the counter row would pass
 * RLS on `user_id` alone.
 */
export async function instructionBelongsToPattern(
  supabase: SupabaseClient,
  instructionId: string,
  patternId: string
): Promise<boolean> {
  const { data: instruction } = await supabase
    .from('pattern_instructions')
    .select('section_id')
    .eq('id', instructionId)
    .maybeSingle()

  if (!instruction?.section_id) return false

  const { data: section } = await supabase
    .from('pattern_sections')
    .select('id')
    .eq('id', instruction.section_id)
    .eq('pattern_id', patternId)
    .maybeSingle()

  return Boolean(section)
}
