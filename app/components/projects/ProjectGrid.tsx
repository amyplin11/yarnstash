import { Project } from '@/lib/types'
import { ProjectCard } from './ProjectCard'

interface ProjectGridProps {
  projects: Project[]
  showAddButton?: boolean
  onAdd?: (projectId: string) => void
  emptyMessage?: string
}

export function ProjectGrid({
  projects,
  showAddButton = false,
  onAdd,
  emptyMessage = 'No projects found.',
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-4">🧶</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {emptyMessage}
        </h3>
        <p className="text-foreground/70 max-w-md">
          Start exploring patterns and add them to your queue!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          showAddButton={showAddButton}
          onAdd={onAdd ? () => onAdd(project.id) : undefined}
        />
      ))}
    </div>
  )
}
