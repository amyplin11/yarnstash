'use client'

import { useState } from 'react'
import { mockProjects } from '@/lib/data/mockProjects'
import { ProjectGrid } from '@/app/components/projects/ProjectGrid'
import { Button } from '@/app/components/ui/Button'

type StatusFilter = 'all' | 'queued' | 'in-progress' | 'completed' | 'frogged'

export default function QueuePage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredProjects = statusFilter === 'all'
    ? mockProjects
    : mockProjects.filter(p => p.status === statusFilter)

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
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Project Queue
          </h1>
          <p className="text-foreground/70">
            Track your knitting projects from queue to completion
          </p>
        </div>

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
        <ProjectGrid
          projects={filteredProjects}
          emptyMessage="No projects found. Start by exploring patterns!"
        />
      </main>
    </div>
  )
}
