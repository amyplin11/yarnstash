import { Yarn, StashYarn } from '@/lib/types'
import { YarnCard } from './YarnCard'

interface YarnGridProps {
  yarns: (Yarn | StashYarn)[]
  showAddButton?: boolean
  onAdd?: (yarnId: string) => void
  editable?: boolean
  onDelete?: (yarnId: string) => void
  emptyMessage?: string
}

export function YarnGrid({
  yarns,
  showAddButton = false,
  onAdd,
  editable = false,
  onDelete,
  emptyMessage = 'No yarns found.',
}: YarnGridProps) {
  if (yarns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-4">🧶</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {emptyMessage}
        </h3>
        <p className="text-foreground/70 max-w-md">
          Browse yarns and add them to your stash!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {yarns.map((yarn) => (
        <YarnCard
          key={yarn.id}
          yarn={yarn}
          showAddButton={showAddButton}
          onAdd={onAdd ? () => onAdd(yarn.id) : undefined}
          editable={editable}
          onDelete={onDelete ? () => onDelete(yarn.id) : undefined}
        />
      ))}
    </div>
  )
}
