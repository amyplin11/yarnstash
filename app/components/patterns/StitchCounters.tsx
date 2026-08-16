'use client'

import { Card } from '@/app/components/ui/Card'
import { ACCENT, type StepAccent } from './stepAccent'
import { CounterName, StepButton } from './CounterControls'
import type { UsePatternCounters } from './usePatternCounters'

/** How to label and colour the step a counter is pinned to. */
export type StepIndex = Map<string, { label: string; accent: StepAccent }>

interface StitchCountersProps {
  api: UsePatternCounters
  /** Lets each counter show which step it belongs to. */
  stepIndex?: StepIndex
  /** Jump into follow mode at a counter's step. */
  onJumpToStep?: (instructionId: string) => void
  className?: string
}

/**
 * The overview card. Every counter on the pattern is here, whether it is
 * pinned to a step or not — the dock only ever shows the step you are on, so
 * this is the one place you can see the whole set and where each one lives.
 */
export function StitchCounters({
  api,
  stepIndex,
  onJumpToStep,
  className = '',
}: StitchCountersProps) {
  const { counters, loading, error, setupRequired, adding, step, addCounter, renameCounter, deleteCounter } = api

  if (setupRequired) {
    // The link ships as a migration; until it is applied, say so plainly
    // rather than showing a broken counter.
    return (
      <Card className={`p-5 mb-8 ${className}`}>
        <h2 className="text-lg font-semibold text-foreground mb-1">Stitch Counters</h2>
        <p className="text-sm text-foreground/60">
          Counters need the migrations in{' '}
          <code className="font-mono text-xs bg-foreground/5 px-1.5 py-0.5 rounded">
            supabase/migrations/
          </code>{' '}
          applied. Run <code className="font-mono text-xs">npm run db:push</code>, then reload.
        </p>
      </Card>
    )
  }

  return (
    <Card className={`p-6 mb-8 ${className}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Stitch Counters</h2>
          <p className="text-sm text-foreground/50">
            Track rows, repeats, or anything else you need to count. Pin one to a
            step and it follows you there.
          </p>
        </div>
        <button
          onClick={() => addCounter()}
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-terracotta hover:bg-terracotta-soft rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {adding ? 'Adding...' : 'Add counter'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-foreground/50">Loading counters...</p>
      ) : counters.length === 0 ? (
        <p className="text-sm text-foreground/50 italic">
          No counters yet. Add one to keep track of where you are.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {counters.map((counter) => {
            const pinned = counter.instruction_id
              ? stepIndex?.get(counter.instruction_id)
              : undefined
            const tone = pinned ? ACCENT[pinned.accent] : null

            return (
              <div
                key={counter.id}
                className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CounterName
                    counter={counter}
                    onRename={renameCounter}
                    inputClass="text-sm w-full"
                    buttonClass="text-sm font-medium text-foreground flex-1 min-w-0"
                  />
                  <button
                    onClick={() => deleteCounter(counter)}
                    title="Delete counter"
                    aria-label={`Delete ${counter.name}`}
                    className="p-1 text-foreground/30 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Where this counter lives. Clicking jumps to that step. */}
                <div className="mb-3 h-6">
                  {pinned && tone ? (
                    <button
                      onClick={() => counter.instruction_id && onJumpToStep?.(counter.instruction_id)}
                      disabled={!onJumpToStep}
                      title={onJumpToStep ? `Go to ${pinned.label}` : undefined}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide transition-opacity ${tone.chip} ${tone.text} ${
                        onJumpToStep ? 'hover:opacity-80 cursor-pointer' : ''
                      }`}
                    >
                      {pinned.label}
                    </button>
                  ) : counter.instruction_id ? (
                    // Pinned to a step that no longer exists after a re-extraction.
                    <span className="text-[0.7rem] uppercase tracking-wide text-foreground/30">
                      step no longer in pattern
                    </span>
                  ) : (
                    <span className="text-[0.7rem] uppercase tracking-wide text-foreground/30">
                      whole pattern
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <StepButton
                    label={`Decrease ${counter.name}`}
                    onClick={() => step(counter, -1)}
                    disabled={counter.value === 0}
                  >
                    −
                  </StepButton>
                  <span className="flex-1 text-center text-4xl font-mono font-bold text-foreground tabular-nums">
                    {counter.value}
                  </span>
                  <StepButton label={`Increase ${counter.name}`} onClick={() => step(counter, 1)} primary>
                    +
                  </StepButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
