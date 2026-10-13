/**
 * Turning a pattern instruction into text worth reading aloud.
 *
 * Text-to-speech reads "ssk" as a word and "k2tog" as noise, so abbreviations
 * are expanded before the text ever reaches ElevenLabs. Pure — no I/O — so the
 * same instruction always produces the same string, which is what lets
 * /api/tts cache by text.
 */

export interface SpeakableInstruction {
  instruction_text: string
  row_start?: number
  row_end?: number
  step_number: number
  is_repeat?: boolean
  repeat_count?: string
  is_setup_row?: boolean
  is_decrease_row?: boolean
  is_increase_row?: boolean
  notes?: string
  size_variations?: Record<string, string>
}

export interface SpeakableOptions {
  /** Size whose `size_variations` entry replaces the base text, as on screen. */
  size?: string | null
  /** The pattern's own abbreviations (`pattern_details.abbreviations`). */
  abbreviations?: Record<string, string>
}

// Standard knitting terms. Keys are matched as whole tokens, case-insensitively.
const STANDARD: Record<string, string> = {
  k: 'knit',
  p: 'purl',
  k2tog: 'knit two together',
  k3tog: 'knit three together',
  p2tog: 'purl two together',
  p3tog: 'purl three together',
  ssk: 'slip slip knit',
  ssp: 'slip slip purl',
  sssk: 'slip slip slip knit',
  sk2p: 'slip one, knit two together, pass slipped stitch over',
  s2kp: 'slip two, knit one, pass slipped stitches over',
  psso: 'pass slipped stitch over',
  kfb: 'knit front and back',
  pfb: 'purl front and back',
  m1: 'make one',
  m1l: 'make one left',
  m1r: 'make one right',
  m1p: 'make one purl',
  yo: 'yarn over',
  sl: 'slip',
  tbl: 'through the back loop',
  wyif: 'with yarn in front',
  wyib: 'with yarn in back',
  tog: 'together',
  st: 'stitch',
  sts: 'stitches',
  rs: 'right side',
  ws: 'wrong side',
  pm: 'place marker',
  sm: 'slip marker',
  rm: 'remove marker',
  bor: 'beginning of round',
  rnd: 'round',
  rnds: 'rounds',
  rep: 'repeat',
  reps: 'repeats',
  inc: 'increase',
  dec: 'decrease',
  beg: 'beginning',
  rem: 'remaining',
  cont: 'continue',
  foll: 'following',
  patt: 'pattern',
  est: 'established',
  co: 'cast on',
  bo: 'bind off',
  cn: 'cable needle',
  dpn: 'double-pointed needle',
  dpns: 'double-pointed needles',
  ea: 'each',
}

// Pattern-defined meanings can be whole techniques ("sl 2 to cn, hold in
// front, k2, k2 from cn"). Reading that at every use would bury the row, so
// long ones are left as the abbreviation itself.
const MAX_INLINE_MEANING = 40

const STITCH_WORDS: Record<string, string> = { k: 'knit', p: 'purl', sl: 'slip' }

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildGlossary(patternAbbreviations?: Record<string, string>): Map<string, string> {
  const glossary = new Map<string, string>()
  for (const [key, meaning] of Object.entries(STANDARD)) glossary.set(key, meaning)
  // The pattern wins on conflict — it knows what it meant by "M1".
  for (const [key, meaning] of Object.entries(patternAbbreviations ?? {})) {
    const k = key.trim().toLowerCase()
    const m = meaning?.trim()
    if (k && m && m.length <= MAX_INLINE_MEANING) glossary.set(k, m)
  }
  return glossary
}

/** Expand abbreviations in one pass, so expanded words are never re-expanded. */
export function expandAbbreviations(
  text: string,
  patternAbbreviations?: Record<string, string>
): string {
  const glossary = buildGlossary(patternAbbreviations)
  // Longest first, so "k2tog" is never matched as "k" + "2tog".
  const keys = [...glossary.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(
    `(?<![A-Za-z0-9])(?:(${keys.map(escapeRegExp).join('|')})|(k|p|sl)(\\d+))(?![A-Za-z0-9])`,
    'gi'
  )
  return text.replace(pattern, (match, key: string | undefined, stitch?: string, count?: string) => {
    if (key) return glossary.get(key.toLowerCase()) ?? match
    // "k2" / "p3" / "sl1" — a stitch and a count.
    return `${STITCH_WORDS[stitch!.toLowerCase()]} ${count}`
  })
}

function speakBody(text: string, abbreviations?: Record<string, string>): string {
  const spoken = expandAbbreviations(text, abbreviations)
    // "rep from *" — the asterisk is a landmark knitters call "star".
    .replace(/\*/g, ' star ')
    // "rows 3–4" → "rows 3 to 4"
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2')
    // "measures 5 in" / 5" → inches; "12 cm" → centimetres
    .replace(/(\d)\s*(?:in\b\.?|")/g, '$1 inches')
    .replace(/(\d)\s*cm\b\.?/g, '$1 centimetres')
  // Each line of a grouped instruction is its own sentence.
  return spoken
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => (/[.!?:;]$/.test(line) ? line : `${line}.`))
    .join(' ')
}

/** The full spoken form of one Follow Mode step. */
export function toSpeakable(instr: SpeakableInstruction, options: SpeakableOptions = {}): string {
  const parts: string[] = []

  if (instr.row_start) {
    parts.push(
      instr.row_end && instr.row_end !== instr.row_start
        ? `Rows ${instr.row_start} to ${instr.row_end}.`
        : `Row ${instr.row_start}.`
    )
  } else {
    parts.push(`Step ${instr.step_number}.`)
  }

  if (instr.is_setup_row) parts.push('Setup row.')
  if (instr.is_decrease_row) parts.push('Decrease row.')
  if (instr.is_increase_row) parts.push('Increase row.')

  const text =
    (options.size && instr.size_variations?.[options.size]) || instr.instruction_text
  parts.push(speakBody(text, options.abbreviations))

  if (instr.is_repeat && instr.repeat_count) {
    parts.push(speakBody(`Repeat ${instr.repeat_count}`, options.abbreviations))
  }
  if (instr.notes) parts.push(`Note: ${speakBody(instr.notes, options.abbreviations)}`)

  return parts.join(' ')
}
