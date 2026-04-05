import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ExtractedPatternData } from '@/lib/types/pattern'

// Phase 2: Full extraction with the user's selected size
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storagePath, selectedSize, fileName } = body as {
      storagePath: string
      selectedSize: string | null
      fileName: string
    }

    if (!storagePath || !fileName) {
      return NextResponse.json({ error: 'Missing storagePath or fileName' }, { status: 400 })
    }

    // Verify the storage path belongs to this user
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pattern-pdfs')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Error downloading PDF:', downloadError)
      return NextResponse.json({ error: 'Failed to retrieve uploaded PDF' }, { status: 500 })
    }

    const buffer = await fileData.arrayBuffer()
    const base64PDF = Buffer.from(buffer).toString('base64')

    // Full extraction with size filtering
    console.log(`Extracting pattern data for size: ${selectedSize ?? 'all sizes'}...`)
    const extractedData = await extractPatternFromPDF(base64PDF, selectedSize)

    // Get public URL for the PDF
    const { data: { publicUrl } } = supabase.storage
      .from('pattern-pdfs')
      .getPublicUrl(storagePath)

    // Insert pattern into database
    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .insert({
        user_id: user.id,
        name: extractedData.name,
        designer: extractedData.designer,
        difficulty: extractedData.difficulty,
        pattern_type: extractedData.pattern_type,
        selected_size: selectedSize,
        pdf_url: publicUrl,
        pdf_filename: fileName,
      })
      .select()
      .single()

    if (patternError) {
      console.error('Error inserting pattern:', patternError)
      return NextResponse.json({ error: 'Failed to save pattern' }, { status: 500 })
    }

    // Insert pattern details
    if (extractedData.details) {
      const { error: detailsError } = await supabase.from('pattern_details').insert({
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
      if (detailsError) {
        console.error('Error inserting pattern details:', detailsError)
      }
    }

    // Insert materials
    if (extractedData.materials && extractedData.materials.length > 0) {
      const materials = extractedData.materials.map((material) => {
        const parseNumeric = (val: unknown): number | null => {
          if (val == null) return null
          if (typeof val === 'number') return val
          if (typeof val === 'string') {
            const n = parseInt(val, 10)
            return isNaN(n) ? null : n
          }
          if (typeof val === 'object') {
            const values = Object.values(val as Record<string, unknown>).map((v) => parseInt(String(v), 10)).filter((n) => !isNaN(n))
            return values.length > 0 ? Math.max(...values) : null
          }
          return null
        }
        return {
          pattern_id: pattern.id,
          yarn_weight: material.yarn_weight,
          yarn_name: material.yarn_name,
          yarn_brand: material.yarn_brand,
          yardage_needed: parseNumeric(material.yardage_needed),
          grams_needed: parseNumeric(material.grams_needed),
          skeins_needed: material.skeins_needed,
          color_name: material.color_name,
          color_order: material.color_order,
        }
      })
      const { error: materialsError } = await supabase.from('pattern_materials').insert(materials)
      if (materialsError) {
        console.error('Error inserting materials:', materialsError)
      }
    }

    // Insert stitch glossary
    if (extractedData.stitch_glossary && extractedData.stitch_glossary.length > 0) {
      const glossaryEntries = extractedData.stitch_glossary.map((entry) => ({
        pattern_id: pattern.id,
        abbreviation: entry.abbreviation,
        name: entry.name,
        description: entry.description,
        stitch_count_change: entry.stitch_count_change ?? 0,
        category: entry.category,
      }))
      const { error: glossaryError } = await supabase.from('pattern_stitch_glossary').insert(glossaryEntries)
      if (glossaryError) {
        console.error('Error inserting stitch glossary:', glossaryError)
      }
    }

    // Insert sections
    let sectionsInserted = 0
    let instructionsInserted = 0
    const sectionErrors: string[] = []

    if (extractedData.sections && extractedData.sections.length > 0) {
      for (let i = 0; i < extractedData.sections.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Claude API response may not match discriminated union exactly
        const section = extractedData.sections[i] as any
        const sectionType = section.section_type || 'written_instructions'
        const sectionName: string =
          (typeof section.section_name === 'string' && section.section_name) ||
          (typeof section.name === 'string' && section.name) ||
          (typeof section.title === 'string' && section.title) ||
          `Section ${i + 1}`
        const sectionOrder: number =
          typeof section.section_order === 'number' ? section.section_order : i + 1

        const { data: sectionData, error: sectionError } = await supabase
          .from('pattern_sections')
          .insert({
            pattern_id: pattern.id,
            section_name: sectionName,
            section_order: sectionOrder,
            description: section.description ?? null,
            section_type: sectionType,
            content: sectionType !== 'written_instructions'
              ? section.content ?? null
              : null,
            applicable_sizes: section.applicable_sizes ?? null,
          })
          .select()
          .single()

        if (sectionError) {
          console.error(`Error inserting section "${sectionName}":`, sectionError)
          sectionErrors.push(`Section "${sectionName}": ${sectionError.message}`)
          continue
        }

        sectionsInserted++

        if (sectionData && sectionType === 'written_instructions') {
          const sectionInstructions =
            section.instructions || section.steps || section.rows || []
          if (sectionInstructions.length === 0) {
            console.warn(`Section "${sectionName}" is written_instructions but has no instructions array. Keys: ${Object.keys(section).join(', ')}`)
          }
          if (sectionInstructions.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Claude API response fields are loosely typed
            const instructions = sectionInstructions.map((instruction: any, j: number) => ({
              section_id: sectionData.id,
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
            const { error: instrError } = await supabase.from('pattern_instructions').insert(instructions)
            if (instrError) {
              console.error(`Error inserting instructions for "${sectionName}":`, instrError)
              sectionErrors.push(`Instructions for "${sectionName}": ${instrError.message}`)
            } else {
              instructionsInserted += instructions.length
            }
          }
        }
      }
    }

    console.log(
      `Pattern "${pattern.name}" saved (size: ${selectedSize ?? 'all'}): ` +
      `${sectionsInserted}/${extractedData.sections?.length ?? 0} sections, ` +
      `${instructionsInserted} instructions` +
      (sectionErrors.length > 0 ? `, ${sectionErrors.length} errors` : '')
    )

    const wasTruncated = extractedData.sections == null || extractedData.sections.length === 0
    const warnings: string[] = []
    if (wasTruncated) {
      warnings.push('No pattern sections were extracted — the PDF may be too complex or the AI response was truncated. Try uploading again.')
    }
    if (sectionErrors.length > 0) {
      warnings.push(`Some sections failed to save: ${sectionErrors.join('; ')}`)
    }

    return NextResponse.json({
      success: true,
      pattern,
      message: 'Pattern uploaded and processed successfully!',
      extraction: {
        sections_extracted: extractedData.sections?.length ?? 0,
        sections_saved: sectionsInserted,
        instructions_saved: instructionsInserted,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  } catch (error) {
    console.error('Error in pattern extraction:', error)
    const message = error instanceof Error ? error.message : 'Failed to process pattern'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildExtractionPrompt(selectedSize: string | null): string {
  const sizeInstruction = selectedSize
    ? `
CRITICAL SIZE FILTERING: The user is making size "${selectedSize}". Wherever the pattern lists values for multiple sizes — often in parenthetical format like "55 (56) 58 (59) 61 (62) 63 (66) 68 (69)" or comma-separated like "120 (132, 144, 156, 168)" — extract ONLY the single value that corresponds to size "${selectedSize}".

The instruction text should read as if the pattern was written for a single size. For example, instead of "CO 55 (56) 58 (59) 61 (62) 63 (66) 68 (69) sts", if the user chose size S, write "CO 58 sts".

Apply this to ALL size-dependent values: stitch counts, row counts, cast-on numbers, repeat counts, measurements, yardage, etc.

Do NOT include a size_variations field — all instructions should contain only values for size "${selectedSize}".
For materials, extract only the yardage/grams/skeins needed for size "${selectedSize}".
For finished_measurements, extract only the measurements for size "${selectedSize}".
`
    : ''

  return `You are a knitting pattern extraction assistant. Analyze this knitting pattern PDF and extract all information into structured JSON.

IMPORTANT: Adapt your extraction to the actual content of the pattern. Not every pattern has charts, not every pattern uses row numbers, and patterns vary widely in structure. Extract what is actually present.

CRITICAL: Never summarize, paraphrase, or condense instruction text. Copy it VERBATIM from the pattern, word for word. The user needs the exact original wording to follow while knitting. The ONLY change you should make is resolving size-specific values as described below.
${sizeInstruction}
## Required fields
- name: The pattern name
- sections: At least one section

## Optional top-level fields
- designer: Designer name
- difficulty: One of "beginner", "easy", "intermediate", "advanced"
- pattern_type: e.g. "sweater", "socks", "shawl", "hat", "blanket", "cowl", "mittens", "scarf"
- construction_method: How the garment is constructed, e.g. "top-down", "bottom-up", "seamed", "seamless", "modular", "toe-up", "cuff-down"
- stitch_techniques: Array of techniques used, e.g. ["stockinette", "cables", "lace", "colorwork", "brioche", "ribbing"]

## Details object
Extract as much as you can find:
- sizes: Array of ALL size names from the pattern (even though instructions are filtered to one size)
- finished_measurements: ${selectedSize ? `Object with only the "${selectedSize}" key and its measurements` : 'Object keyed by size, each value is an object of measurement name to value string'}
- gauge: { stitches, rows, needle_size, notes }
- needles: Array of { size, type, length? }
- notions: Array of strings
- abbreviations: Object of abbreviation to meaning (standard abbreviations used in the pattern text)

## Stitch glossary
If the pattern defines special stitches (beyond standard K, P, K2tog, etc.), extract them as stitch_glossary:
- abbreviation: The abbreviation used in the pattern (e.g. "C4F", "Bobble", "SSK")
- name: Full name if given
- description: The full instructions for performing the stitch
- stitch_count_change: Net change in stitch count (0 for cables, -1 for decreases, +1 for increases)
- category: One of "decrease", "increase", "cable", "lace", "texture", "other"

Only include stitches that the pattern explicitly defines or explains. Do NOT include standard abbreviations like K, P, YO here -- those go in details.abbreviations.

## Materials
Array of yarn requirements:
- yarn_weight, yarn_name, yarn_brand
- yardage_needed: Total yardage as a single integer${selectedSize ? ` for size "${selectedSize}"` : ' (use the largest size if amounts vary by size)'}
- grams_needed: Total grams as a single integer${selectedSize ? ` for size "${selectedSize}"` : ' (use the largest size if amounts vary by size)'}
- skeins_needed: ${selectedSize ? `Number of skeins needed for size "${selectedSize}"` : 'Object keyed by size name to number of skeins, e.g. {"XS": 3, "S": 3, "M": 4}'}
- color_name (e.g. "Main Color", "Contrast Color A"), color_order

## Sections
Each section represents a major part of the pattern. EVERY section MUST include these fields:
- section_name: A descriptive name for the section (e.g. "Body", "Sleeves", "Yoke", "Construction Notes", "Finishing")
- section_order: Integer, sequential starting from 1
- section_type: One of the types below

Choose the right section_type based on content:

### section_type: "written_instructions"
For step-by-step knitting instructions. MUST include an "instructions" array field containing objects with:
- step_number (sequential within the section)
- instruction_text (the EXACT verbatim text from the pattern${selectedSize ? `, with all size-dependent values resolved to size "${selectedSize}" only` : ''})
- row_start, row_end (if specific rows/rounds are mentioned)
- is_repeat, repeat_count (if this step is repeated)
- is_setup_row, is_decrease_row, is_increase_row (boolean flags)
- notes (any clarifying notes)
- measurement_target: If using measurement instead of row count, e.g. "6 inches" or "15 cm"
- stitch_references: Array of stitch glossary abbreviations used, e.g. ["C4F", "SSK"]

IMPORTANT — Grouping instructions: When an instruction introduces sub-steps (e.g. "Join new yarn and work as follows:" followed by Row 1, Row 2, Row 3), combine the introduction AND all its sub-steps into a SINGLE instruction_text, separated by newlines. Each step should be a self-contained action the knitter performs — do NOT split rows/sub-steps that belong to the same logical group into separate steps.

Good: "Join new yarn and work as follows:\nRow 1 (WS): Purl to 30 sts until there are 31 sts left on the needle, turn.\nRow 2 (RS): Knit until there are 28 sts left on the needle, turn.\nRow 3 (WS): Purl until there are 28 sts left on the needle, turn."

Bad: Splitting the above into 4 separate steps (step 4: "Join new yarn...", step 5: "Row 1...", step 6: "Row 2...", step 7: "Row 3...")

Similarly, "Continue working short rows as follows:" + its rows = one step. "Repeat these 2 rows" + the rows = one step.

### section_type: "chart"
For charted instructions. Provide content object with:
- chart_type: "knitting", "colorwork", "lace", "cable", or "other"
- total_rows, total_stitches
- grid: 2D array of symbols (each row is an array). For colorwork use color keys like "MC", "CC1". Omit if too complex.
- legend: Object mapping symbols to meanings
- read_flat: true if odd rows read right-to-left (flat knitting)
- written_equivalent: Array of { row, right_side, text } if the pattern provides written chart rows
- notes

### section_type: "stitch_pattern"
For stitch pattern definitions used repeatedly (e.g. "Lace Panel", "Cable Panel A"). Content:
- stitch_name, panel_width (stitches per repeat), row_repeat (rows per repeat)
- instructions: Array of { row, text, right_side? }
- chart: Optional chart if also provided
- notes

### section_type: "schematic"
For schematic/measurement descriptions. Content:
- description, measurements (${selectedSize ? `only for size "${selectedSize}"` : 'keyed by size to name-value pairs'}), notes

### section_type: "notes"
For construction notes, finishing, blocking, or other prose. Content:
- text: The full text
- topics: Array of tags, e.g. ["construction", "finishing", "blocking", "seaming"]

## Section organization guidelines
- Use the pattern's own section structure (e.g. "Body", "Sleeves", "Yoke", "Heel Turn")
- If a section has both a chart and written instructions, create two sections in order
- Construction/finishing notes that aren't step-by-step should be "notes" type
- Stitch pattern definitions separate from main instructions should be "stitch_pattern" type
- Number sections in the order they appear

Return ONLY valid JSON. No markdown fencing, no explanations.`
}

async function extractPatternFromPDF(base64PDF: string, selectedSize: string | null): Promise<ExtractedPatternData> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const prompt = buildExtractionPrompt(selectedSize)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25,output-128k-2025-02-19',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64000,
      system: 'You are a knitting pattern extraction assistant. You MUST respond with ONLY valid JSON. No prose, no markdown, no code fences — just the raw JSON object starting with { and ending with }.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64PDF,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
        {
          role: 'assistant',
          content: '{',
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Anthropic API error:', response.status, errorData)
    const apiMessage = errorData?.error?.message || `API returned ${response.status}`
    throw new Error(`Claude API error: ${apiMessage}`)
  }

  const data = await response.json()
  const responseText = data.content[0]?.type === 'text' ? data.content[0].text : ''
  const stopReason = data.stop_reason

  if (!responseText) {
    throw new Error('Claude returned an empty response')
  }

  if (stopReason === 'max_tokens') {
    console.warn('Claude response was truncated (hit max_tokens limit)')
  }

  try {
    let jsonText = '{' + responseText

    if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```(?:json)?\n?/g, '').replace(/\n?```/g, '')
    }

    jsonText = jsonText.trim()

    // If truncated, try to fix by closing open braces/brackets
    if (stopReason === 'max_tokens') {
      let braces = 0
      let brackets = 0
      let inString = false
      let escaped = false
      for (const ch of jsonText) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') braces++
        else if (ch === '}') braces--
        else if (ch === '[') brackets++
        else if (ch === ']') brackets--
      }
      jsonText = jsonText.replace(/,\s*$/, '')
      for (let i = 0; i < brackets; i++) jsonText += ']'
      for (let i = 0; i < braces; i++) jsonText += '}'
    }

    const parsedData = JSON.parse(jsonText) as ExtractedPatternData

    console.log('\n=== PATTERN EXTRACTION RESULT ===')
    console.log(`Size filter: ${selectedSize ?? 'none'}`)
    console.log(`stop_reason: ${stopReason}`)
    console.log(`Response length: ${jsonText.length} chars`)
    console.log(`Name: ${parsedData.name}`)
    console.log(`Designer: ${parsedData.designer}`)
    console.log(`Sections: ${parsedData.sections?.length ?? 0}`)
    if (parsedData.sections && parsedData.sections.length > 0) {
      for (const s of parsedData.sections) {
        const instrCount = ('instructions' in s ? (s.instructions as unknown[])?.length : 0) ?? 0
        console.log(`  > [${s.section_type || 'written_instructions'}] "${s.section_name}" (order: ${s.section_order}${instrCount > 0 ? `, ${instrCount} instructions` : ''})`)
      }
    } else {
      console.log('  WARNING: NO SECTIONS EXTRACTED')
      console.log('  Top-level keys:', Object.keys(parsedData).join(', '))
      console.log('  Response tail (last 500 chars):', jsonText.slice(-500))
    }
    console.log(`Materials: ${parsedData.materials?.length ?? 0}`)
    console.log(`Stitch glossary: ${parsedData.stitch_glossary?.length ?? 0}`)
    console.log(`Details present: ${!!parsedData.details}`)
    if (stopReason === 'max_tokens') {
      console.warn('WARNING: RESPONSE WAS TRUNCATED (hit max_tokens) — sections may be incomplete')
    }
    console.log('=================================\n')

    return parsedData
  } catch (error) {
    console.error('Failed to parse Claude response:', error)
    console.error('Response start:', ('{' + responseText).substring(0, 500))
    console.error('Response end:', ('{' + responseText).slice(-300))
    throw new Error('Failed to parse extracted pattern data — Claude may have returned invalid JSON')
  }
}
