'use client'

import { useState } from 'react'
import type { PatternCounter } from '@/lib/types/pattern'

/** The round −/+ button. Shared so the dock and the overview card feel identical. */
export function StepButton({
  children,
  label,
  onClick,
  disabled = false,
  primary = false,
  size = 'md',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  size?: 'sm' | 'md'
}) {
  const sizeStyles = size === 'sm' ? 'w-9 h-9 text-lg' : 'w-11 h-11 text-2xl'
  const colorStyles = primary
    ? 'bg-terracotta text-parchment hover:bg-terracotta-deep'
    : 'bg-foreground/5 text-foreground hover:bg-foreground/10'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex-shrink-0 inline-flex items-center justify-center rounded-full font-semibold leading-none transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta disabled:opacity-40 disabled:cursor-not-allowed ${sizeStyles} ${colorStyles}`}
    >
      {children}
    </button>
  )
}

/**
 * Click-to-rename label. Owns its own draft state so callers don't have to
 * thread editing state through — a counter is renamed in place, wherever it
 * happens to be rendered.
 */
export function CounterName({
  counter,
  onRename,
  inputClass = '',
  buttonClass = '',
}: {
  counter: PatternCounter
  onRename: (counter: PatternCounter, name: string) => void
  inputClass?: string
  buttonClass?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(counter.name)

  const commit = () => {
    setEditing(false)
    onRename(counter, draft)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={60}
        aria-label="Counter name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(counter.name)
            setEditing(false)
          }
        }}
        onFocus={(e) => e.target.select()}
        className={`bg-surface border border-terracotta/40 rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 ${inputClass}`}
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(counter.name)
        setEditing(true)
      }}
      title="Rename counter"
      className={`text-left rounded-lg px-2 py-1 -mx-2 hover:bg-foreground/5 transition-colors truncate ${buttonClass}`}
    >
      {counter.name}
    </button>
  )
}
