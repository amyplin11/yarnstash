import { Project } from '@/lib/types'
import { Card } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'

interface ProjectCardProps {
  project: Project
  showAddButton?: boolean
  onAdd?: () => void
}

export function ProjectCard({ project, showAddButton = false, onAdd }: ProjectCardProps) {
  return (
    <Card className="p-4 space-y-3">
      {/* Image */}
      {project.imageUrl ? (
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
          <img
            src={project.imageUrl}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/20 dark:to-teal-800/20 rounded-md flex items-center justify-center">
          <span className="text-6xl">🧶</span>
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg text-foreground line-clamp-1">
            {project.name}
          </h3>
          <Badge text={project.status} variant={project.status} />
        </div>

        {/* Pattern */}
        <p className="text-sm text-foreground/70">
          Pattern: {project.pattern}
        </p>

        {/* Designer */}
        {project.designer && (
          <p className="text-xs text-foreground/60">
            by {project.designer}
          </p>
        )}

        {/* Difficulty */}
        {project.difficulty && (
          <Badge text={project.difficulty} variant="secondary" className="text-xs" />
        )}

        {/* Yarn Info */}
        {project.yarn.length > 0 && (
          <div className="text-sm text-foreground/70 space-y-1">
            <p className="font-medium text-xs text-foreground/80">Yarn:</p>
            {project.yarn.map((y, index) => (
              <p key={index} className="text-xs">
                {y.yarnName} - {y.colorway}
                {y.skeinsUsed !== undefined
                  ? ` (${y.skeinsUsed}/${y.skeinsNeeded} skeins)`
                  : ` (${y.skeinsNeeded} skeins)`}
              </p>
            ))}
          </div>
        )}

        {/* Notes */}
        {project.notes && (
          <p className="text-xs text-foreground/60 italic line-clamp-2">
            {project.notes}
          </p>
        )}

        {/* Action Button */}
        {showAddButton && onAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="w-full mt-2"
          >
            Add to Queue
          </Button>
        )}
      </div>
    </Card>
  )
}
