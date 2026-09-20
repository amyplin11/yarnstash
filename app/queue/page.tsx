'use client'

import { useState } from 'react'
import { useProjects } from '@/lib/projects/ProjectsContext'
import { ProjectGrid } from '@/app/components/projects/ProjectGrid'
import { Button } from '@/app/components/ui/Button'
import { Card } from '@/app/components/ui/Card'

type StatusFilter = 'all' | 'queued' | 'in-progress' | 'completed' | 'frogged'

export default function QueuePage() {
  const { projects, loading, error } = useProjects()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredProjects = statusFilter === 'all'
    ? projects
    : projects.filter(p => p.status === statusFilter)

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Queued', value: 'queued' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Frogged', value: 'frogged' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-5xl tracking-tight text-ink mb-3">
            Project Queue
          </h1>
          <p className="text-foreground/70">
            Track your knitting projects from queue to completion
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 mb-8 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm text-foreground/90">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filterButtons.map((button) => (
            <Button
              key={button.value}
              variant={statusFilter === button.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(button.value)}
            >
              {button.label}
            </Button>
          ))}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4 animate-bounce">🧶</div>
            <p className="text-foreground/70">Loading your projects...</p>
          </div>
        ) : (
          <ProjectGrid
            projects={filteredProjects}
            emptyMessage={
              projects.length === 0
                ? 'No projects yet.'
                : 'No projects match this filter.'
            }
          />
        )}
      </main>
    </div>
  )
}
