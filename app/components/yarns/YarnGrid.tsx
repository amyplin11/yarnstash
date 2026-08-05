import { Yarn, StashYarn } from '@/lib/types'
import { YarnCard } from './YarnCard'
import { YarnEmpty } from './YarnEmpty'

interface YarnGridProps {
  yarns: (Yarn | StashYarn)[]
  showAddButton?: boolean
  onAdd?: (yarnId: string) => void
  editable?: boolean
  onDelete?: (yarnId: string) => void
  /** Opens a card for editing. Cards are only clickable when this is supplied. */
  onSelect?: (yarnId: string) => void
  emptyMessage?: string
}

export function YarnGrid({
  yarns,
  showAddButton = false,
  onAdd,
  editable = false,
  onDelete,
  onSelect,
  emptyMessage = 'No yarns found.',
}: YarnGridProps) {
  if (yarns.length === 0) {
    return <YarnEmpty message={emptyMessage} />
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
          onSelect={onSelect ? () => onSelect(yarn.id) : undefined}
        />
      ))}
    </div>
  )
}
