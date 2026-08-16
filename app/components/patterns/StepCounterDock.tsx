'use client'

import { useState } from 'react'
import type { PatternCounter } from '@/lib/types/pattern'
import { ACCENT, type StepAccent } from './stepAccent'
import { CounterName, StepButton } from './CounterControls'
import type { UsePatternCounters } from './usePatternCounters'

/**
 * The floating counter dock shown while following a pattern.
 *
 * It hovers over the bottom of the step column rather than sitting in the
 * scroll flow, so the count stays under your thumb no matter how long the
 * instruction runs. Three things tie it to the step above it: it borrows that
 * step's accent colour for its rail, it names the step in its header, and it
 * only ever counts for the step you are actually on. Navigate away and the
 * dock re-points at the new step.
 *
 * Pattern-wide counters ride along underneath a divider — they are the ones
 * that mean something everywhere ("total rows"), so hiding them per step would
 * lose the count a knitter most wants to see.
 */
export function StepCounterDock({
  api,
  instructionId,
  accent,
  label,
}: {
  api: UsePatternCounters
  instructionId: string
  accent: StepAccent
  label: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { counters, loading, error, setupRequired, adding, step, addCounter, renameCounter, deleteCounter, reassignCounter } = api

  const tone = ACCENT[accent]
  const stepCounters = counters.filter((c) => c.instruction_id === instructionId)
  const patternCounters = counters.filter((c) => !c.instruction_id)

  if (loading) return null

  if (setupRequired) {
    return (
      <DockShell tone={tone.rail}>
        <p className="px-4 py-3 text-xs text-foreground/60">
          Counters need the migrations in{' '}
          <code className="font-mono bg-foreground/5 px-1 py-0.5 rounded">
            supabase/migrations/
          </code>{' '}
          applied — run <code className="font-mono">npm run db:push</code>.
        </p>
      </DockShell>
    )
  }

  // Collapsed: a slim bar that still shows where you are and the leading count.
  if (collapsed) {
    const lead = stepCounters[0] ?? patternCounters[0]
    return (
      <DockShell tone={tone.rail}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
          aria-label="Expand counters"
        >
          <span className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>{label}</span>
          {lead && (
            <span className="text-sm text-foreground/70 truncate">
              {lead.name}{' '}
              <span className="font-mono font-bold text-foreground tabular-nums">{lead.value}</span>
            </span>
          )}
          <ChevronUp className="ml-auto w-4 h-4 text-foreground/40" />
        </button>
      </DockShell>
    )
  }

  return (
    <DockShell tone={tone.rail}>
      {/* Header — names the step the dock is counting for */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${tone.chip} ${tone.text}`}
        >
          {label}
        </span>
        <span className="text-xs text-foreground/40">
          {stepCounters.length > 0 ? 'counting this step' : 'no counter on this step yet'}
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto p-1 text-foreground/40 hover:text-foreground transition-colors"
          aria-label="Collapse counters"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}

      {/* This step's counters */}
      {stepCounters.length > 0 && (
        <div className="px-4 pb-1 space-y-1.5">
          {stepCounters.map((counter) => (
            <CounterRow
              key={counter.id}
              counter={counter}
              onStep={step}
              onRename={renameCounter}
              onDelete={deleteCounter}
              pinAction={{
                label: 'Make pattern-wide',
                pinned: true,
                onClick: () => reassignCounter(counter, null),
              }}
            />
          ))}
        </div>
      )}

      {/* Attach a new counter to this step */}
      <div className="px-4 pb-3 pt-1">
        <button
          onClick={() => addCounter({ name: label, instructionId })}
          disabled={adding}
          className={`w-full rounded-xl border border-dashed border-foreground/20 py-2 text-sm text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50`}
        >
          {adding ? 'Adding…' : `+ Count ${label.toLowerCase()}`}
        </button>
      </div>

      {/* Pattern-wide counters, clearly a separate group */}
      {patternCounters.length > 0 && (
        <div className="border-t border-foreground/10 px-4 py-2 space-y-1.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/35">
            Whole pattern
          </p>
          {patternCounters.map((counter) => (
            <CounterRow
              key={counter.id}
              counter={counter}
              onStep={step}
              onRename={renameCounter}
              onDelete={deleteCounter}
              muted
              pinAction={{
                label: `Pin to ${label}`,
                pinned: false,
                onClick: () => reassignCounter(counter, instructionId),
              }}
            />
          ))}
        </div>
      )}
    </DockShell>
  )
}

/**
 * Fixed to the bottom of the viewport but constrained to the same max-w-3xl
 * column the step card uses, so it reads as hanging off that card rather than
 * off the window.
 */
function DockShell({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pb-3">
        <div className="pointer-events-auto flex overflow-hidden rounded-2xl border border-foreground/10 bg-surface/95 backdrop-blur shadow-lg shadow-black/10">
          {/* The rail is the tie: same colour as the step card's border */}
          <div className={`w-1.5 flex-shrink-0 ${tone}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

function CounterRow({
  counter,
  onStep,
  onRename,
  onDelete,
  pinAction,
  muted = false,
}: {
  counter: PatternCounter
  onStep: (counter: PatternCounter, delta: number) => void
  onRename: (counter: PatternCounter, name: string) => void
  onDelete: (counter: PatternCounter) => void
  pinAction: { label: string; pinned: boolean; onClick: () => void }
  muted?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${muted ? 'opacity-75' : ''}`}>
      <CounterName
        counter={counter}
        onRename={onRename}
        inputClass="text-sm w-32"
        buttonClass="text-sm font-medium text-foreground flex-1 min-w-0"
      />

      <button
        onClick={pinAction.onClick}
        title={pinAction.label}
        aria-label={pinAction.label}
        className={`p-1 transition-colors ${
          pinAction.pinned
            ? 'text-foreground/50 hover:text-foreground'
            : 'text-foreground/25 hover:text-foreground/60'
        }`}
      >
        <PinIcon className="w-3.5 h-3.5" filled={pinAction.pinned} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <StepButton
          label={`Decrease ${counter.name}`}
          onClick={() => onStep(counter, -1)}
          disabled={counter.value === 0}
          size="sm"
        >
          −
        </StepButton>
        <span className="min-w-[2.75rem] text-center text-2xl font-mono font-bold text-foreground tabular-nums">
          {counter.value}
        </span>
        <StepButton
          label={`Increase ${counter.name}`}
          onClick={() => onStep(counter, 1)}
          size="sm"
          primary
        >
          +
        </StepButton>
        <button
          onClick={() => onDelete(counter)}
          title="Delete counter"
          aria-label={`Delete ${counter.name}`}
          className="p-1 text-foreground/25 hover:text-red-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function PinIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
    </svg>
  )
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}
