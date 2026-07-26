// Extraction prompt for pattern PDFs. Kept verbatim from the original inline
// version so extraction behaviour is unchanged by the move to a background job.

export function buildExtractionPrompt(selectedSize: string | null): string {
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
