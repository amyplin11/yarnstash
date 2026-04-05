'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { Card } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import type { NotesContent, ChartContent, StitchPatternContent, SchematicContent } from '@/lib/types/pattern'

interface Instruction {
  id: string
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
}

interface Section {
  id: string
  section_name: string
  section_order: number
  description?: string
  section_type?: string
  content?: unknown
  instructions: Instruction[]
}

interface WipData {
  id: string
  current_section_id?: string
  current_instruction_id?: string
  completed_instructions?: string[]
  row_counter?: number
  selected_size?: string
  last_worked_at?: string
}

interface PatternData {
  pattern: {
    id: string
    name: string
    designer?: string
    difficulty?: string
    pattern_type?: string
    pdf_url?: string
    pdf_filename?: string
    notes?: string
    created_at: string
  }
  details: {
    sizes?: string[]
    finished_measurements?: Record<string, Record<string, string>>
    gauge_stitches?: number
    gauge_rows?: number
    gauge_needle_size?: string
    gauge_notes?: string
    needles?: Array<{ size: string; type: string; length?: string }>
    notions?: string[]
    abbreviations?: Record<string, string>
    construction_method?: string
    stitch_techniques?: string[]
  } | null
  materials: Array<{
    id: string
    yarn_weight?: string
    yarn_name?: string
    yarn_brand?: string
    yardage_needed?: number
    grams_needed?: number
    skeins_needed?: Record<string, number>
    color_name?: string
  }>
  sections: Section[]
  wip: WipData | null
}

interface FlatStep {
  sectionId: string
  sectionName: string
  instruction: Instruction
  globalIndex: number
}

const difficultyVariant: Record<string, 'success' | 'info' | 'warning' | 'frogged'> = {
  beginner: 'success',
  easy: 'info',
  intermediate: 'warning',
  advanced: 'frogged',
}

export default function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<PatternData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [followMode, setFollowMode] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [flatSteps, setFlatSteps] = useState<FlatStep[]>([])
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [showSizePicker, setShowSizePicker] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && id) {
      fetchPattern()
    }
  }, [user, id])

  // Build flattened step list when data loads
  useEffect(() => {
    if (!data) return
    const steps: FlatStep[] = []
    let globalIndex = 0
    for (const section of data.sections) {
      const sectionType = section.section_type || 'written_instructions'
      if (sectionType === 'written_instructions' && section.instructions.length > 0) {
        for (const instruction of section.instructions) {
          steps.push({
            sectionId: section.id,
            sectionName: section.section_name,
            instruction,
            globalIndex,
          })
          globalIndex++
        }
      }
    }
    setFlatSteps(steps)

    // If there's saved wip, find the matching step index
    if (data.wip?.current_instruction_id && steps.length > 0) {
      const savedIndex = steps.findIndex(
        (s) => s.instruction.id === data.wip!.current_instruction_id
      )
      if (savedIndex >= 0) {
        setCurrentStepIndex(savedIndex)
      }
    }
  }, [data])

  const fetchPattern = async () => {
    try {
      const response = await fetch(`/api/patterns/${id}`)
      if (!response.ok) {
        if (response.status === 404) throw new Error('Pattern not found')
        throw new Error('Failed to fetch pattern')
      }
      const result = await response.json()
      setData(result)
      if (result.wip?.selected_size) {
        setSelectedSize(result.wip.selected_size)
      }
      if (result.sections?.length > 0) {
        setExpandedSections(new Set([result.sections[0].id]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern')
    } finally {
      setLoading(false)
    }
  }

  // Auto-save progress (debounced)
  const saveProgress = useCallback(
    (stepIndex: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        if (!flatSteps[stepIndex]) return
        const step = flatSteps[stepIndex]
        try {
          await fetch(`/api/patterns/${id}/wip`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_section_id: step.sectionId,
              current_instruction_id: step.instruction.id,
              selected_size: selectedSize,
            }),
          })
        } catch (err) {
          console.error('Failed to save progress:', err)
        }
      }, 500)
    },
    [flatSteps, id, selectedSize]
  )

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= flatSteps.length) return
      setCurrentStepIndex(index)
      saveProgress(index)
    },
    [flatSteps.length, saveProgress]
  )

  const enterFollowMode = useCallback(() => {
    if (data?.wip?.current_instruction_id && flatSteps.length > 0) {
      const savedIndex = flatSteps.findIndex(
        (s) => s.instruction.id === data.wip!.current_instruction_id
      )
      if (savedIndex >= 0) {
        setCurrentStepIndex(savedIndex)
      }
    }
    // If the pattern has sizes and none is selected yet, show size picker first
    const hasSizes = data?.details?.sizes && data.details.sizes.length > 0
    if (hasSizes && !selectedSize) {
      setShowSizePicker(true)
      return
    }
    setFollowMode(true)
  }, [data, flatSteps, selectedSize])

  // Get the instruction text for the user's selected size
  const textForSize = (instr: Instruction): string => {
    if (selectedSize && instr.size_variations?.[selectedSize]) {
      return instr.size_variations[selectedSize]
    }
    return instr.instruction_text
  }

  // Split grouped instruction text into lead paragraph + numbered sub-steps
  const renderInstructionText = (text: string, large?: boolean) => {
    const lines = text.split('\n')
    // Find where numbered sub-steps start (e.g. "Row 1", "Rnd 1", "Round 1", "Step 1", "1.", "1)")
    const subStepPattern = /^(Row|Rnd|Round|Step)\s+\d|^\d+[.)]/i
    const firstSubIdx = lines.findIndex((l) => subStepPattern.test(l.trim()))

    if (firstSubIdx < 0) {
      // No sub-steps — render as plain text
      const cls = large
        ? 'text-xl leading-relaxed text-foreground whitespace-pre-wrap'
        : 'text-sm text-foreground whitespace-pre-wrap'
      return <p className={cls}>{text}</p>
    }

    const lead = lines.slice(0, firstSubIdx).join('\n').trim()
    const steps = lines.slice(firstSubIdx)

    const textCls = large ? 'text-xl leading-relaxed text-foreground' : 'text-sm text-foreground'
    const listCls = large
      ? 'list-decimal list-inside space-y-2 mt-2 text-lg leading-relaxed text-foreground'
      : 'list-decimal list-inside space-y-1 mt-1 text-sm text-foreground'

    return (
      <>
        {lead && <p className={textCls}>{lead}</p>}
        <ol className={listCls}>
          {steps.map((step, i) => {
            // Strip the leading "Row N (RS): " / "Rnd N: " prefix to avoid double numbering
            const stripped = step.trim().replace(/^(Row|Rnd|Round|Step)\s+\d+\s*(\([^)]*\)\s*)?:\s*/i, '')
            const label = step.trim().match(/^(Row|Rnd|Round|Step)\s+\d+\s*(\([^)]*\))?/i)?.[0]
            return (
              <li key={i}>
                {label && <span className="font-medium">{label}: </span>}
                {stripped}
              </li>
            )
          })}
        </ol>
      </>
    )
  }

  const handleSizeSelect = useCallback(
    (size: string | null) => {
      setSelectedSize(size)
      // Persist to WIP (fire-and-forget)
      fetch(`/api/patterns/${id}/wip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_size: size }),
      }).catch((err) => console.error('Failed to save size:', err))
    },
    [id]
  )

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this pattern? This cannot be undone.')) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/patterns/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete pattern')
      router.push('/patterns')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pattern')
      setDeleting(false)
    }
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground/70">Loading pattern...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <p className="text-foreground/70 mb-4">{error || 'Pattern not found'}</p>
          <Link href="/patterns">
            <Button variant="primary">Back to Patterns</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const { pattern, details, materials, sections } = data
  const hasGauge = details?.gauge_stitches || details?.gauge_rows
  const currentStep = flatSteps[currentStepIndex]

  // ─── Size picker screen ───
  if (showSizePicker && details?.sizes && details.sizes.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowSizePicker(false)}
              className="inline-flex items-center text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <p className="text-sm text-foreground/50">
              {pattern.name}
            </p>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Choose your size</h2>
            <p className="text-foreground/60">Instructions will be filtered to your selected size.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
            {details.sizes.map((size) => (
              <button
                key={size}
                onClick={() => {
                  handleSizeSelect(size)
                  setShowSizePicker(false)
                  setFollowMode(true)
                }}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-colors bg-foreground/5 text-foreground/70 hover:bg-teal-600 hover:text-white"
              >
                {size}
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // ─── Follow-along mode ───
  if (followMode && currentStep) {
    const instr = currentStep.instruction

    // Find which section step we're on within this section
    const sectionSteps = flatSteps.filter((s) => s.sectionId === currentStep.sectionId)
    const stepInSection = sectionSteps.findIndex(
      (s) => s.instruction.id === instr.id
    ) + 1

    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setFollowMode(false)}
              className="inline-flex items-center text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Overview
            </button>
            <div className="flex items-center gap-2">
              {selectedSize && (
                <Badge text={`Size ${selectedSize}`} variant="primary" />
              )}
              <p className="text-sm text-foreground/50">
                {pattern.name}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground/70">
                Step {currentStepIndex + 1} of {flatSteps.length}
              </p>
              <p className="text-sm text-foreground/50">
                {Math.round(((currentStepIndex + 1) / flatSteps.length) * 100)}%
              </p>
            </div>
            <div className="w-full bg-foreground/10 rounded-full h-2">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / flatSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Section context */}
          <div className="text-center mb-4">
            <p className="text-sm text-foreground/50 uppercase tracking-wide">
              {currentStep.sectionName}
            </p>
            <p className="text-xs text-foreground/40 mt-1">
              Step {stepInSection} of {sectionSteps.length} in this section
            </p>
          </div>

          {/* Main instruction card */}
          <Card className={`p-8 mb-6 ${
            instr.is_setup_row
              ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10'
              : instr.is_decrease_row
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10'
              : instr.is_increase_row
              ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10'
              : ''
          }`}>
            {/* Row/step label */}
            <div className="flex items-center gap-2 mb-4">
              {instr.row_start ? (
                <span className="text-lg font-mono font-bold text-teal-600 dark:text-teal-400">
                  {instr.row_start === instr.row_end || !instr.row_end
                    ? `Row ${instr.row_start}`
                    : `Rows ${instr.row_start}–${instr.row_end}`}
                </span>
              ) : (
                <span className="text-lg font-mono font-bold text-teal-600 dark:text-teal-400">
                  Step {instr.step_number}
                </span>
              )}

              {/* Flags */}
              {instr.is_setup_row && <Badge text="setup" variant="info" />}
              {instr.is_decrease_row && <Badge text="decrease" variant="warning" />}
              {instr.is_increase_row && <Badge text="increase" variant="success" />}
            </div>

            {/* Instruction text */}
            {renderInstructionText(textForSize(instr), true)}

            {/* Repeat info */}
            {instr.is_repeat && instr.repeat_count && (
              <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  Repeat {instr.repeat_count}
                </p>
              </div>
            )}

            {/* Notes */}
            {instr.notes && (
              <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
                <p className="text-sm text-foreground/70 italic">{instr.notes}</p>
              </div>
            )}

            {/* Size variations — only show when no size is selected */}
            {!selectedSize && instr.size_variations && Object.keys(instr.size_variations).length > 0 && (
              <div className="mt-4 border-t border-foreground/10 pt-4">
                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">
                  Size variations
                </p>
                <div className="space-y-1">
                  {Object.entries(instr.size_variations).map(([size, text]) => (
                    <p key={size} className="text-sm text-foreground/70">
                      <span className="font-medium">{size}:</span> {text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => goToStep(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </Button>

            <Button
              variant="primary"
              size="lg"
              onClick={() => goToStep(currentStepIndex + 1)}
              disabled={currentStepIndex >= flatSteps.length - 1}
            >
              Next
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // ─── Overview mode (default) ───
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <Link
          href="/patterns"
          className="inline-flex items-center text-sm text-foreground/60 hover:text-foreground mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Patterns
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-4xl font-bold text-foreground">{pattern.name}</h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {pattern.designer && (
              <p className="text-foreground/70">by {pattern.designer}</p>
            )}
            {pattern.difficulty && (
              <Badge
                text={pattern.difficulty}
                variant={difficultyVariant[pattern.difficulty] || 'secondary'}
              />
            )}
            {pattern.pattern_type && (
              <Badge text={pattern.pattern_type} variant="secondary" />
            )}
            {details?.construction_method && (
              <Badge text={details.construction_method} variant="secondary" />
            )}
          </div>
          {details?.stitch_techniques && details.stitch_techniques.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {details.stitch_techniques.map((t) => (
                <Badge key={t} text={t} variant="primary" />
              ))}
            </div>
          )}
        </div>

        {/* Size picker */}
        {details?.sizes && details.sizes.length > 0 && (
          <Card className="p-5 mb-8">
            <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">
              {selectedSize ? 'Your size' : 'Choose your size'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {details.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => handleSizeSelect(selectedSize === size ? null : size)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSize === size
                      ? 'bg-teal-600 text-white'
                      : 'bg-foreground/5 text-foreground/70 hover:bg-foreground/10'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            {selectedSize && (
              <p className="text-xs text-foreground/50 mt-2">
                Instructions will show values for size {selectedSize}. Click again to deselect.
              </p>
            )}
          </Card>
        )}

        {/* Info cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {hasGauge && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">Gauge</h3>
              <div className="space-y-1">
                {details!.gauge_stitches && (
                  <p className="text-foreground">{details!.gauge_stitches} sts</p>
                )}
                {details!.gauge_rows && (
                  <p className="text-foreground">{details!.gauge_rows} rows</p>
                )}
                <p className="text-sm text-foreground/60">per 4 inches / 10 cm</p>
                {details!.gauge_needle_size && (
                  <p className="text-sm text-foreground/70 mt-1">{details!.gauge_needle_size}</p>
                )}
                {details!.gauge_notes && (
                  <p className="text-sm text-foreground/60 mt-1 italic">{details!.gauge_notes}</p>
                )}
              </div>
            </Card>
          )}

          {details?.needles && details.needles.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wide mb-3">Needles</h3>
              <ul className="space-y-1">
                {details.needles.map((needle, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {needle.size} {needle.type}{needle.length ? ` — ${needle.length}` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Materials */}
        {materials.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Materials</h2>
            <div className="space-y-3">
              {materials.map((mat) => (
                <div key={mat.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {mat.color_name && (
                    <span className="text-sm font-medium text-foreground/70">{mat.color_name}:</span>
                  )}
                  <span className="text-foreground">
                    {[mat.yarn_brand, mat.yarn_name].filter(Boolean).join(' ') || 'Yarn'}
                  </span>
                  {mat.yarn_weight && (
                    <Badge text={mat.yarn_weight} variant="secondary" />
                  )}
                  {mat.yardage_needed && (
                    <span className="text-sm text-foreground/60">{mat.yardage_needed} yds</span>
                  )}
                  {mat.grams_needed && (
                    <span className="text-sm text-foreground/60">{mat.grams_needed}g</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Notions */}
        {details?.notions && details.notions.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Notions</h2>
            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
              {details.notions.map((notion, i) => (
                <li key={i}>{notion}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* Empty sections warning */}
        {sections.length === 0 && (
          <Card className="p-6 mb-8 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">No pattern instructions found</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  The AI extraction did not capture any step-by-step instructions from this PDF. This can happen if the pattern is very long and the response was truncated. You can try deleting this pattern and re-uploading.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Sections / Instructions */}
        {sections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-foreground">Pattern Instructions</h2>
              {flatSteps.length > 0 && (
                <Button variant="primary" onClick={enterFollowMode}>
                  {data.wip?.current_instruction_id ? 'Continue' : 'Step by Step'}
                </Button>
              )}
            </div>

            {/* Resume banner */}
            {data.wip?.current_instruction_id && flatSteps.length > 0 && (() => {
              const savedStep = flatSteps.find(
                (s) => s.instruction.id === data.wip!.current_instruction_id
              )
              if (!savedStep) return null
              return (
                <Card
                  className="p-4 mb-2 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-950/30 transition-colors"
                  onClick={enterFollowMode}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                        Continue where you left off
                      </p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
                        {savedStep.sectionName} — Step {savedStep.globalIndex + 1} of {flatSteps.length}
                        {data.wip?.last_worked_at && (
                          <> — last worked {new Date(data.wip.last_worked_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              )
            })()}

            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id)
              const sectionType = section.section_type || 'written_instructions'

              return (
                <Card key={section.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{section.section_name}</h3>
                      {sectionType !== 'written_instructions' && (
                        <Badge text={sectionType.replace('_', ' ')} variant="info" />
                      )}
                      {section.description && (
                        <span className="text-sm text-foreground/50 hidden sm:inline">
                          {section.description}
                        </span>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 text-foreground/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-foreground/10">
                      {sectionType === 'written_instructions' && section.instructions.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {section.instructions.map((instr) => (
                            <div
                              key={instr.id}
                              className={`flex gap-4 p-3 rounded-lg ${
                                instr.is_setup_row
                                  ? 'bg-blue-50 dark:bg-blue-950/20'
                                  : instr.is_decrease_row
                                  ? 'bg-amber-50 dark:bg-amber-950/20'
                                  : instr.is_increase_row
                                  ? 'bg-green-50 dark:bg-green-950/20'
                                  : 'bg-foreground/5'
                              }`}
                            >
                              <div className="flex-shrink-0 w-12 text-right">
                                {instr.row_start ? (
                                  <span className="text-sm font-mono text-foreground/60">
                                    {instr.row_start === instr.row_end || !instr.row_end
                                      ? `R${instr.row_start}`
                                      : `R${instr.row_start}-${instr.row_end}`}
                                  </span>
                                ) : (
                                  <span className="text-sm font-mono text-foreground/40">
                                    {instr.step_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {renderInstructionText(textForSize(instr))}
                                {instr.is_repeat && instr.repeat_count && (
                                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                                    Repeat {instr.repeat_count}
                                  </p>
                                )}
                                {instr.notes && (
                                  <p className="text-xs text-foreground/50 mt-1 italic">
                                    {instr.notes}
                                  </p>
                                )}
                                {!selectedSize && instr.size_variations && Object.keys(instr.size_variations).length > 0 && (
                                  <div className="mt-2 text-xs text-foreground/60 space-y-0.5">
                                    {Object.entries(instr.size_variations).map(([size, text]) => (
                                      <p key={size}>
                                        <span className="font-medium">{size}:</span> {text}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {sectionType === 'notes' && section.content != null && (
                        <div className="mt-4 text-sm text-foreground whitespace-pre-wrap">
                          {(section.content as NotesContent).text || JSON.stringify(section.content, null, 2)}
                        </div>
                      )}

                      {sectionType === 'chart' && section.content != null && (
                        <div className="mt-4">
                          <p className="text-sm text-foreground/60 italic">
                            Chart data extracted. Chart visualization coming soon.
                          </p>
                          {(section.content as ChartContent).notes && (
                            <p className="text-sm text-foreground/70 mt-2">
                              {(section.content as ChartContent).notes}
                            </p>
                          )}
                        </div>
                      )}

                      {sectionType === 'stitch_pattern' && section.content != null && (
                        <div className="mt-4 space-y-2">
                          {(section.content as StitchPatternContent).stitch_name && (
                            <p className="font-medium text-foreground">
                              {(section.content as StitchPatternContent).stitch_name}
                            </p>
                          )}
                          {(section.content as StitchPatternContent).instructions?.map(
                            (row, i) => (
                              <div key={i} className="flex gap-4 p-2 bg-foreground/5 rounded text-sm">
                                <span className="font-mono text-foreground/50 w-10 text-right">R{row.row}</span>
                                <span className="text-foreground">{row.text}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {sectionType === 'schematic' && section.content != null && (
                        <div className="mt-4 text-sm text-foreground/70">
                          <p>{(section.content as SchematicContent).description}</p>
                        </div>
                      )}

                      {sectionType === 'written_instructions' && section.instructions.length === 0 && (
                        <p className="mt-4 text-sm text-foreground/50 italic">No instructions extracted for this section.</p>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* PDF link */}
        {pattern.pdf_url && (
          <Card className="p-6 mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Original PDF</h3>
                <p className="text-sm text-foreground/60">{pattern.pdf_filename || 'pattern.pdf'}</p>
              </div>
              <a
                href={pattern.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View PDF
              </a>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
