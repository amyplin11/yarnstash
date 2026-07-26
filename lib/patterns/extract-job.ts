import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { ExtractedPatternData } from '@/lib/types/pattern'
import { buildExtractionPrompt } from './extraction-prompt'

// claude-sonnet-4-20250514 was retired and now returns 404, which broke
// extraction outright. Sonnet 5 is the documented successor for that tier.
// Change this one constant to move tiers (e.g. 'claude-opus-5').
const EXTRACTION_MODEL = 'claude-sonnet-5'

// Sonnet 5 allows up to 128k output tokens. Thinking is disabled below, so the
// whole budget goes to the extraction itself.
const MAX_OUTPUT_TOKENS = 96000

// How often to write streaming progress back to the job row.
const PROGRESS_INTERVAL_MS = 2000

type JobStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

interface PatternJob {
  id: string
  user_id: string
  status: JobStatus
  storage_path: string
  file_name: string
  selected_size: string | null
}

async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from('pattern_jobs').update(patch).eq('id', jobId)
  if (error) console.error(`[job ${jobId}] failed to update job row:`, error.message)
}

/**
 * Runs a pattern extraction to completion and records the outcome on the job
 * row. Safe to call after the HTTP response has been sent (via `after()`):
 * it uses the service-role client, so it does not depend on request cookies.
 *
 * Never throws — every failure path is written to the job row instead, so the
 * client polling that row always reaches a terminal state.
 */
export async function runExtractionJob(jobId: string): Promise<void> {
  let supabase: SupabaseClient
  try {
    supabase = createAdminClient()
  } catch (error) {
    console.error(`[job ${jobId}] cannot create admin client:`, error)
    return
  }

  const { data: job, error: jobError } = await supabase
    .from('pattern_jobs')
    .select('id, user_id, status, storage_path, file_name, selected_size')
    .eq('id', jobId)
    .single<PatternJob>()

  if (jobError || !job) {
    console.error(`[job ${jobId}] job row not found:`, jobError?.message)
    return
  }

  // Guard against a double-dispatch re-running finished work.
  if (job.status !== 'pending') {
    console.warn(`[job ${jobId}] already ${job.status}, skipping`)
    return
  }

  await updateJob(supabase, jobId, {
    status: 'processing',
    started_at: new Date().toISOString(),
  })

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pattern-pdfs')
      .download(job.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to retrieve uploaded PDF: ${downloadError?.message ?? 'not found'}`)
    }

    const buffer = await fileData.arrayBuffer()
    const base64PDF = Buffer.from(buffer).toString('base64')

    const extractedData = await extractPatternFromPDF(
      base64PDF,
      job.selected_size,
      async (progress) => updateJob(supabase, jobId, { progress })
    )

    const { publicUrl } = supabase.storage
      .from('pattern-pdfs')
      .getPublicUrl(job.storage_path).data

    const { patternId, patternName, warnings } = await persistPattern(
      supabase,
      job,
      extractedData,
      publicUrl
    )

    await updateJob(supabase, jobId, {
      status: 'succeeded',
      pattern_id: patternId,
      pattern_name: patternName,
      warnings: warnings.length > 0 ? warnings : null,
      finished_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process pattern'
    console.error(`[job ${jobId}] extraction failed:`, error)
    await updateJob(supabase, jobId, {
      status: 'failed',
      error: message,
      finished_at: new Date().toISOString(),
    })
  }
}

// === Claude extraction (streaming) ===

interface ExtractionProgress {
  chars: number
}

/**
 * Streams the extraction from Claude.
 *
 * Streaming matters here for two reasons: a blocking request at this
 * max_tokens is the shape most likely to trip an HTTP idle timeout (nothing
 * returns until the whole generation finishes), and the incremental deltas
 * give us real progress to report.
 */
async function extractPatternFromPDF(
  base64PDF: string,
  selectedSize: string | null,
  onProgress: (progress: ExtractionProgress) => Promise<void>
): Promise<ExtractedPatternData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic()

  const stream = client.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Sonnet 5 runs adaptive thinking when `thinking` is omitted, which would
    // consume part of max_tokens. This is a mechanical extraction, so the whole
    // budget is better spent on output.
    thinking: { type: 'disabled' },
    system:
      'You are a knitting pattern extraction assistant. Respond with ONLY a raw JSON object, ' +
      'starting with { and ending with }. No prose, no markdown, no code fences.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
          },
          { type: 'text', text: buildExtractionPrompt(selectedSize) },
        ],
      },
    ],
  })

  let chars = 0
  let lastReport = Date.now()
  stream.on('text', (delta) => {
    chars += delta.length
    const now = Date.now()
    if (now - lastReport >= PROGRESS_INTERVAL_MS) {
      lastReport = now
      // Fire-and-forget: progress is advisory, and must not stall the stream.
      void onProgress({ chars })
    }
  })

  const message = await stream.finalMessage()

  // Previously this was silently patched up by counting braces and closing
  // them, which produced a partial pattern that looked successful. A truncated
  // extraction is a real failure — surface it.
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      `Extraction exceeded the ${MAX_OUTPUT_TOKENS}-token output limit and was truncated. ` +
        `This usually means the pattern is unusually long; try extracting a single size.`
    )
  }

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!responseText.trim()) {
    throw new Error('Claude returned an empty response')
  }

  return parseExtraction(responseText, selectedSize)
}

function parseExtraction(
  responseText: string,
  selectedSize: string | null
): ExtractedPatternData {
  let jsonText = responseText.trim()

  // Defensive: the system prompt forbids fences, but strip them if present.
  if (jsonText.includes('```')) {
    jsonText = jsonText.replace(/```(?:json)?\n?/g, '').replace(/\n?```/g, '').trim()
  }

  try {
    const parsed = JSON.parse(jsonText) as ExtractedPatternData
    console.log(
      `Extraction parsed (size: ${selectedSize ?? 'all'}): ` +
        `${parsed.sections?.length ?? 0} sections, ` +
        `${parsed.materials?.length ?? 0} materials, ` +
        `${parsed.stitch_glossary?.length ?? 0} glossary entries`
    )
    return parsed
  } catch {
    console.error('Failed to parse extraction. Head:', jsonText.slice(0, 300))
    console.error('Tail:', jsonText.slice(-300))
    throw new Error('Claude returned invalid JSON for this pattern')
  }
}

// === Persistence ===

function parseNumeric(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }
  if (typeof val === 'object') {
    const values = Object.values(val as Record<string, unknown>)
      .map((v) => parseInt(String(v), 10))
      .filter((n) => !isNaN(n))
    return values.length > 0 ? Math.max(...values) : null
  }
  return null
}

async function persistPattern(
  supabase: SupabaseClient,
  job: PatternJob,
  extractedData: ExtractedPatternData,
  publicUrl: string
): Promise<{ patternId: string; patternName: string; warnings: string[] }> {
  const warnings: string[] = []

  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .insert({
      user_id: job.user_id,
      name: extractedData.name,
      designer: extractedData.designer,
      difficulty: extractedData.difficulty,
      pattern_type: extractedData.pattern_type,
      selected_size: job.selected_size,
      pdf_url: publicUrl,
      pdf_filename: job.file_name,
    })
    .select()
    .single()

  if (patternError || !pattern) {
    throw new Error(`Failed to save pattern: ${patternError?.message ?? 'unknown error'}`)
  }

  if (extractedData.details) {
    const { error } = await supabase.from('pattern_details').insert({
      pattern_id: pattern.id,
      sizes: extractedData.details.sizes,
      finished_measurements: extractedData.details.finished_measurements,
      gauge_stitches: extractedData.details.gauge?.stitches,
      gauge_rows: extractedData.details.gauge?.rows,
      gauge_needle_size: extractedData.details.gauge?.needle_size,
      gauge_notes: extractedData.details.gauge?.notes,
      needles: extractedData.details.needles,
      notions: extractedData.details.notions,
      abbreviations: extractedData.details.abbreviations,
      raw_extraction: extractedData,
      construction_method: extractedData.construction_method,
      stitch_techniques: extractedData.stitch_techniques,
    })
    if (error) warnings.push(`Pattern details failed to save: ${error.message}`)
  }

  if (extractedData.materials?.length) {
    const materials = extractedData.materials.map((material) => ({
      pattern_id: pattern.id,
      yarn_weight: material.yarn_weight,
      yarn_name: material.yarn_name,
      yarn_brand: material.yarn_brand,
      yardage_needed: parseNumeric(material.yardage_needed),
      grams_needed: parseNumeric(material.grams_needed),
      skeins_needed: material.skeins_needed,
      color_name: material.color_name,
      color_order: material.color_order,
    }))
    const { error } = await supabase.from('pattern_materials').insert(materials)
    if (error) warnings.push(`Materials failed to save: ${error.message}`)
  }

  if (extractedData.stitch_glossary?.length) {
    const glossaryEntries = extractedData.stitch_glossary.map((entry) => ({
      pattern_id: pattern.id,
      abbreviation: entry.abbreviation,
      name: entry.name,
      description: entry.description,
      stitch_count_change: entry.stitch_count_change ?? 0,
      category: entry.category,
    }))
    const { error } = await supabase.from('pattern_stitch_glossary').insert(glossaryEntries)
    if (error) warnings.push(`Stitch glossary failed to save: ${error.message}`)
  }

  const { sectionsInserted, instructionsInserted, sectionErrors } =
    await persistSections(supabase, pattern.id, extractedData)

  warnings.push(...sectionErrors)

  if (!extractedData.sections?.length) {
    warnings.push(
      'No pattern sections were extracted — the PDF may not be a readable knitting pattern.'
    )
  }

  console.log(
    `Pattern "${pattern.name}" saved (size: ${job.selected_size ?? 'all'}): ` +
      `${sectionsInserted}/${extractedData.sections?.length ?? 0} sections, ` +
      `${instructionsInserted} instructions` +
      (sectionErrors.length > 0 ? `, ${sectionErrors.length} errors` : '')
  )

  return { patternId: pattern.id, patternName: pattern.name, warnings }
}

async function persistSections(
  supabase: SupabaseClient,
  patternId: string,
  extractedData: ExtractedPatternData
) {
  let sectionsInserted = 0
  let instructionsInserted = 0
  const sectionErrors: string[] = []

  if (!extractedData.sections?.length) {
    return { sectionsInserted, instructionsInserted, sectionErrors }
  }

  // Insert all sections in one round trip, preserving order so the returned
  // rows can be matched back to their source by section_order.
  const sectionRows = extractedData.sections.map((rawSection, i) => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Claude's
       response may not match the discriminated union exactly */
    const s = rawSection as any
    const sectionType = s.section_type || 'written_instructions'
    const sectionName: string =
      (typeof s.section_name === 'string' && s.section_name) ||
      (typeof s.name === 'string' && s.name) ||
      (typeof s.title === 'string' && s.title) ||
      `Section ${i + 1}`

    return {
      pattern_id: patternId,
      section_name: sectionName,
      section_order: typeof s.section_order === 'number' ? s.section_order : i + 1,
      description: s.description ?? null,
      section_type: sectionType,
      content: sectionType !== 'written_instructions' ? s.content ?? null : null,
      applicable_sizes: s.applicable_sizes ?? null,
    }
  })

  const { data: insertedSections, error: sectionsError } = await supabase
    .from('pattern_sections')
    .insert(sectionRows)
    .select('id, section_order')

  if (sectionsError || !insertedSections) {
    sectionErrors.push(`Sections failed to save: ${sectionsError?.message ?? 'unknown error'}`)
    return { sectionsInserted, instructionsInserted, sectionErrors }
  }

  sectionsInserted = insertedSections.length

  const idByOrder = new Map<number, string>(
    insertedSections.map((row) => [row.section_order as number, row.id as string])
  )

  const allInstructions = extractedData.sections.flatMap((rawSection, i) => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above */
    const s = rawSection as any
    const sectionType = s.section_type || 'written_instructions'
    if (sectionType !== 'written_instructions') return []

    const sectionOrder = typeof s.section_order === 'number' ? s.section_order : i + 1
    const sectionId = idByOrder.get(sectionOrder)
    if (!sectionId) return []

    const instructions = s.instructions || s.steps || s.rows || []
    if (instructions.length === 0) {
      console.warn(
        `Section "${sectionRows[i].section_name}" is written_instructions but has no ` +
          `instructions array. Keys: ${Object.keys(s).join(', ')}`
      )
      return []
    }

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above */
    return instructions.map((instruction: any, j: number) => ({
      section_id: sectionId,
      step_number: instruction.step_number ?? j + 1,
      instruction_text: instruction.instruction_text || instruction.text || '',
      row_start: instruction.row_start,
      row_end: instruction.row_end,
      is_repeat: instruction.is_repeat,
      repeat_count: instruction.repeat_count,
      is_setup_row: instruction.is_setup_row,
      is_decrease_row: instruction.is_decrease_row,
      is_increase_row: instruction.is_increase_row,
      notes: instruction.notes,
      size_variations: instruction.size_variations,
      measurement_target: instruction.measurement_target,
      stitch_references: instruction.stitch_references,
    }))
  })

  if (allInstructions.length > 0) {
    const { error } = await supabase.from('pattern_instructions').insert(allInstructions)
    if (error) {
      sectionErrors.push(`Instructions failed to save: ${error.message}`)
    } else {
      instructionsInserted = allInstructions.length
    }
  }

  return { sectionsInserted, instructionsInserted, sectionErrors }
}
