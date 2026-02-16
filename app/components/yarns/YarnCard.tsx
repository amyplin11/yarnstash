import { Yarn, StashYarn } from '@/lib/types'
import { Card } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'

interface YarnCardProps {
  yarn: Yarn | StashYarn
  showAddButton?: boolean
  onAdd?: () => void
  editable?: boolean
  onDelete?: () => void
}

export function YarnCard({ yarn, showAddButton = false, onAdd, editable = false, onDelete }: YarnCardProps) {
  // Determine if this is a StashYarn or regular Yarn
  const isStashYarn = 'skeins' in yarn
  const yarnData = isStashYarn ? yarn.yarn : yarn
  const stashInfo = isStashYarn ? yarn : null

  // Get first color for display
  const displayColor = yarnData.colors && yarnData.colors.length > 0
    ? yarnData.colors[0].hexCode || '#9CA3AF'
    : '#9CA3AF'

  return (
    <Card className="p-4 space-y-3">
      {/* Color Swatch */}
      {yarnData.imageUrl ? (
        <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
          <img
            src={yarnData.imageUrl}
            alt={`${yarnData.brand} ${yarnData.name}`}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-32 rounded-md"
          style={{ backgroundColor: displayColor }}
        />
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Brand & Name */}
        <div>
          <p className="text-xs text-foreground/60 uppercase tracking-wide">
            {yarnData.brand}
          </p>
          <h3 className="font-semibold text-base text-foreground line-clamp-1">
            {yarnData.name}
          </h3>
        </div>

        {/* Weight */}
        <Badge text={yarnData.weight} variant="primary" className="text-xs" />

        {/* Fiber Content */}
        <p className="text-sm text-foreground/70">
          {yarnData.fiberContent}
        </p>

        {/* Yardage & Weight */}
        <div className="flex justify-between text-xs text-foreground/60">
          <span>{yarnData.yardage} yds</span>
          <span>{yarnData.gramsPerSkein}g</span>
        </div>

        {/* Price */}
        {yarnData.price && (
          <p className="text-sm font-medium text-foreground">
            ${yarnData.price.toFixed(2)}
          </p>
        )}

        {/* Stash Info */}
        {isStashYarn && stashInfo && (
          <div className="pt-2 border-t border-foreground/10 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/70">In stash:</span>
              <span className="font-semibold text-foreground">{stashInfo.skeins} skeins</span>
            </div>
            {stashInfo.colorway && (
              <p className="text-xs text-foreground/60">
                Colorway: {stashInfo.colorway}
              </p>
            )}
            {stashInfo.location && (
              <p className="text-xs text-foreground/60">
                Location: {stashInfo.location}
              </p>
            )}
          </div>
        )}

        {/* Colors Available */}
        {yarnData.colors && yarnData.colors.length > 1 && (
          <div className="pt-2">
            <p className="text-xs text-foreground/60 mb-1">
              {yarnData.colors.length} colors available
            </p>
            <div className="flex gap-1 flex-wrap">
              {yarnData.colors.slice(0, 5).map((color) => (
                <div
                  key={color.id}
                  className="w-6 h-6 rounded-full border border-foreground/20"
                  style={{ backgroundColor: color.hexCode || '#9CA3AF' }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {showAddButton && onAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAdd}
              className="w-full"
            >
              Add to Stash
            </Button>
          )}
          {editable && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1">
                Edit
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onDelete}
                >
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
