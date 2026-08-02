'use client'

import { useHydrated } from './useHydrated'

/**
 * The weekday/date rail shown beside a page title.
 *
 * Read on the client rather than during render: these pages are statically
 * prerendered, so a server-side `new Date()` would freeze the stamp at build
 * time and show a stale day forever.
 */
export function TodayStamp({ className = '' }: { className?: string }) {
  const hydrated = useHydrated()
  const now = hydrated ? new Date() : null

  return (
    <div className={`lg:text-right ${className}`}>
      <p className="font-display text-3xl text-ink">
        {now ? now.toLocaleDateString('en-US', { weekday: 'long' }) : ' '}
      </p>
      <p className="eyebrow mt-1 text-ink-soft">
        {now
          ? now
              .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              .toUpperCase()
          : ' '}
      </p>
    </div>
  )
}
