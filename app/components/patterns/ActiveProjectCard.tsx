import Link from 'next/link'
import { Card } from '@/app/components/ui/Card'
import type { Pattern } from '@/lib/types/pattern'

/**
 * A pattern being knitted right now, as shown under "Current Projects".
 *
 * Shared by the patterns library and the dashboard so the two cannot drift
 * apart the way their in-progress rules once did.
 */
export function ActiveProjectCard({ pattern }: { pattern: Pattern }) {
  const progress = pattern.progress

  return (
    // ?resume=1 — the card promises "Resume →", so the pattern page drops
    // straight into step-by-step rather than landing on the overview.
    <Link href={`/patterns/${pattern.id}?resume=1`}>
      <Card className="h-full border-transparent bg-terracotta p-6 text-parchment transition-colors hover:bg-terracotta-deep">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl tracking-tight">{pattern.name}</h3>
          <span className="eyebrow shrink-0 rounded-full bg-parchment/15 px-3 py-1">
            In progress
          </span>
        </div>

        {pattern.designer && (
          <p className="mt-2 text-sm text-parchment/75">by {pattern.designer}</p>
        )}

        <dl className="mt-6 space-y-1 text-sm text-parchment/75">
          {progress?.selected_size && (
            <div className="flex gap-2">
              <dt>Size</dt>
              <dd className="font-medium text-parchment">{progress.selected_size}</dd>
            </div>
          )}
          {progress?.row_counter !== undefined && (
            <div className="flex gap-2">
              <dt>Row</dt>
              <dd className="font-medium text-parchment">{progress.row_counter}</dd>
            </div>
          )}
          {progress?.completed_instructions?.length ? (
            <div className="flex gap-2">
              <dt>Steps done</dt>
              <dd className="font-medium text-parchment">
                {progress.completed_instructions.length}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex items-center justify-between border-t border-parchment/20 pt-4 text-sm">
          <span className="text-parchment/70">
            {progress?.last_worked_at
              ? `Last worked ${new Date(progress.last_worked_at).toLocaleDateString()}`
              : 'Just started'}
          </span>
          <span className="font-medium">Resume →</span>
        </div>
      </Card>
    </Link>
  )
}
