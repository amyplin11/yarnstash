/**
 * Shared styling for "which step is this?".
 *
 * The floating counter dock has to read as belonging to the instruction card
 * above it. That only works if the two agree on a colour and a label, so both
 * take them from here rather than each rolling their own — otherwise the tie
 * silently breaks the next time one side is restyled.
 */

/** The subset of an instruction these helpers need. */
export interface StepShape {
  step_number: number
  row_start?: number | null
  row_end?: number | null
  is_setup_row?: boolean | null
  is_decrease_row?: boolean | null
  is_increase_row?: boolean | null
}

export type StepAccent = 'setup' | 'decrease' | 'increase' | 'plain'

/**
 * Flags are checked in the same order the instruction card renders its badges,
 * so a row marked both setup and decrease picks up the same colour in both
 * places.
 */
export function stepAccent(instr: StepShape): StepAccent {
  if (instr.is_setup_row) return 'setup'
  if (instr.is_decrease_row) return 'decrease'
  if (instr.is_increase_row) return 'increase'
  return 'plain'
}

/**
 * "Row 12", "Rows 12–16", or "Step 4" when the pattern carries no row numbers.
 * Matches the heading on the instruction card exactly.
 */
export function stepLabel(instr: StepShape): string {
  if (!instr.row_start) return `Step ${instr.step_number}`
  if (!instr.row_end || instr.row_end === instr.row_start) return `Row ${instr.row_start}`
  return `Rows ${instr.row_start}–${instr.row_end}`
}

interface AccentClasses {
  /** Border + wash on the instruction card. */
  card: string
  /** Solid rail down the edge of the dock. */
  rail: string
  /** Label text on the dock header and the counter chip. */
  text: string
  /** Soft background behind the step chip. */
  chip: string
  /** Halo on the instruction card while that step owns a counter. */
  ring: string
}

// Written out in full rather than composed, so Tailwind can see every class.
export const ACCENT: Record<StepAccent, AccentClasses> = {
  setup: {
    card: 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10',
    rail: 'bg-blue-400 dark:bg-blue-600',
    text: 'text-blue-700 dark:text-blue-300',
    chip: 'bg-blue-100 dark:bg-blue-950/40',
    ring: 'ring-2 ring-blue-400/40 dark:ring-blue-600/40',
  },
  decrease: {
    card: 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10',
    rail: 'bg-amber-400 dark:bg-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-100 dark:bg-amber-950/40',
    ring: 'ring-2 ring-amber-400/40 dark:ring-amber-600/40',
  },
  increase: {
    card: 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10',
    rail: 'bg-green-400 dark:bg-green-600',
    text: 'text-green-700 dark:text-green-300',
    chip: 'bg-green-100 dark:bg-green-950/40',
    ring: 'ring-2 ring-green-400/40 dark:ring-green-600/40',
  },
  plain: {
    card: '',
    rail: 'bg-terracotta',
    text: 'text-terracotta dark:text-terracotta',
    chip: 'bg-terracotta-soft dark:bg-terracotta-deep/20',
    ring: 'ring-2 ring-terracotta/30',
  },
}
