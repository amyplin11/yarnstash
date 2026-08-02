'use client'

import type { SVGProps } from 'react'

interface ViewToggleOption<T extends string> {
  value: T
  label: string
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement
}

/**
 * A segmented control for switching between renderings of the same data.
 * `aria-pressed` rather than a radiogroup: these are buttons that act at once,
 * not a choice that gets submitted.
 */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: ViewToggleOption<T>[]
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface p-1"
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const active = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={active}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
              active
                ? 'bg-terracotta text-parchment'
                : 'text-ink-muted hover:bg-parchment-deep hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}
