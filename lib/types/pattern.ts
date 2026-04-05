// Pattern-related types for PDF import and viewing

export interface Pattern {
  id: string
  user_id: string
  name: string
  designer?: string
  difficulty?: 'beginner' | 'easy' | 'intermediate' | 'advanced'
  pattern_type?: string
  pdf_url?: string
  pdf_filename?: string
  ravelry_id?: number
  ravelry_url?: string
  notes?: string
  selected_size?: string
  tags?: string[]
  created_at?: Date
  updated_at?: Date
}

export interface PatternDetails {
  id: string
  pattern_id: string
  sizes?: string[]
  finished_measurements?: Record<string, Record<string, string>>
  gauge_stitches?: number
  gauge_rows?: number
  gauge_needle_size?: string
  gauge_notes?: string
  needles?: Array<{
    size: string
    type: string
    length?: string
  }>
  notions?: string[]
  abbreviations?: Record<string, string>
  raw_extraction?: ExtractedPatternData
  construction_method?: string
  stitch_techniques?: string[]
  created_at?: Date
}

export interface PatternMaterial {
  id: string
  pattern_id: string
  yarn_weight?: string
  yarn_name?: string
  yarn_brand?: string
  yardage_needed?: number
  grams_needed?: number
  skeins_needed?: Record<string, number>
  color_name?: string
  color_order?: number
  suggested_stash_yarn_id?: string
  created_at?: Date
}

// === Section types ===

export type SectionType =
  | 'written_instructions'
  | 'chart'
  | 'stitch_pattern'
  | 'schematic'
  | 'notes'

export interface PatternSection {
  id: string
  pattern_id: string
  section_name: string
  section_order: number
  description?: string
  section_type: SectionType
  content?: ChartContent | StitchPatternContent | SchematicContent | NotesContent
  applicable_sizes?: string[]
  created_at?: Date
}

export interface PatternInstruction {
  id: string
  section_id: string
  step_number: number
  instruction_text: string
  row_start?: number
  row_end?: number
  is_repeat?: boolean
  repeat_count?: string
  is_setup_row?: boolean
  is_decrease_row?: boolean
  is_increase_row?: boolean
  notes?: string
  size_variations?: Record<string, string>
  measurement_target?: string
  stitch_references?: string[]
  created_at?: Date
}

// === Stitch glossary ===

export interface PatternStitchGlossary {
  id: string
  pattern_id: string
  abbreviation: string
  name?: string
  description: string
  stitch_count_change?: number
  category?: 'decrease' | 'increase' | 'cable' | 'lace' | 'texture' | 'other'
  created_at?: Date
}

// === Progress tracking ===

export interface UserPatternProgress {
  id: string
  user_id: string
  pattern_id: string
  project_id?: string
  current_section_id?: string
  current_instruction_id?: string
  completed_instructions?: string[]
  selected_size?: string
  row_counter?: number
  repeat_counter?: number
  progress_notes?: string
  chart_position?: {
    section_id: string
    chart_row: number
    chart_col: number
  }
  completed_sections?: string[]
  started_at?: Date
  last_worked_at?: Date
  completed_at?: Date
}

export interface PatternNote {
  id: string
  user_id: string
  pattern_id: string
  instruction_id?: string
  note_text: string
  note_type?: 'general' | 'tip' | 'warning' | 'modification'
  is_pinned?: boolean
  created_at?: Date
  updated_at?: Date
}

// === Complete pattern with all related data ===

export interface FullPattern {
  pattern: Pattern
  details?: PatternDetails
  materials: PatternMaterial[]
  sections: Array<PatternSection & { instructions: PatternInstruction[] }>
  stitch_glossary: PatternStitchGlossary[]
  progress?: UserPatternProgress
  notes: PatternNote[]
}

// === Section content types ===

export interface ChartContent {
  chart_type: 'knitting' | 'colorwork' | 'lace' | 'cable' | 'other'
  total_rows: number
  total_stitches: number
  grid?: string[][]
  legend?: Record<string, string>
  read_flat?: boolean
  written_equivalent?: Array<{
    row: number
    right_side: boolean
    text: string
  }>
  notes?: string
}

export interface StitchPatternContent {
  stitch_name: string
  panel_width: number
  row_repeat: number
  instructions: Array<{
    row: number
    text: string
    right_side?: boolean
  }>
  chart?: ChartContent
  notes?: string
}

export interface SchematicContent {
  description: string
  measurements: Record<string, Record<string, string>>
  notes?: string
}

export interface NotesContent {
  text: string
  topics?: string[]
}

// === Extraction types (Claude API response) ===

export interface ExtractedInstruction {
  step_number: number
  instruction_text: string
  row_start?: number
  row_end?: number
  is_repeat?: boolean
  repeat_count?: string
  is_setup_row?: boolean
  is_decrease_row?: boolean
  is_increase_row?: boolean
  notes?: string
  size_variations?: Record<string, string>
  measurement_target?: string
  stitch_references?: string[]
}

export interface ExtractedStitchGlossaryEntry {
  abbreviation: string
  name?: string
  description: string
  stitch_count_change?: number
  category?: 'decrease' | 'increase' | 'cable' | 'lace' | 'texture' | 'other'
}

// Discriminated union for sections

interface ExtractedSectionBase {
  section_name: string
  section_order: number
  description?: string
  applicable_sizes?: string[]
}

export interface ExtractedWrittenSection extends ExtractedSectionBase {
  section_type: 'written_instructions'
  instructions: ExtractedInstruction[]
}

export interface ExtractedChartSection extends ExtractedSectionBase {
  section_type: 'chart'
  content: ChartContent
}

export interface ExtractedStitchPatternSection extends ExtractedSectionBase {
  section_type: 'stitch_pattern'
  content: StitchPatternContent
}

export interface ExtractedSchematicSection extends ExtractedSectionBase {
  section_type: 'schematic'
  content: SchematicContent
}

export interface ExtractedNotesSection extends ExtractedSectionBase {
  section_type: 'notes'
  content: NotesContent
}

export type ExtractedSection =
  | ExtractedWrittenSection
  | ExtractedChartSection
  | ExtractedStitchPatternSection
  | ExtractedSchematicSection
  | ExtractedNotesSection

// Top-level extraction result from Claude

export interface ExtractedPatternData {
  name: string
  designer?: string
  difficulty?: 'beginner' | 'easy' | 'intermediate' | 'advanced'
  pattern_type?: string
  construction_method?: string
  stitch_techniques?: string[]
  details: {
    sizes?: string[]
    finished_measurements?: Record<string, Record<string, string>>
    gauge?: {
      stitches?: number
      rows?: number
      needle_size?: string
      notes?: string
    }
    needles?: Array<{
      size: string
      type: string
      length?: string
    }>
    notions?: string[]
    abbreviations?: Record<string, string>
  }
  materials: Array<{
    yarn_weight?: string
    yarn_name?: string
    yarn_brand?: string
    yardage_needed?: number
    grams_needed?: number
    skeins_needed?: Record<string, number>
    color_name?: string
    color_order?: number
  }>
  stitch_glossary?: ExtractedStitchGlossaryEntry[]
  sections: ExtractedSection[]
}
