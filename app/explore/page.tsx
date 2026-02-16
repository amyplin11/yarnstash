'use client'

import { useState, useEffect } from 'react'
import { Project } from '@/lib/types'
import { ProjectGrid } from '@/app/components/projects/ProjectGrid'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPatterns()
  }, [])

  const fetchPatterns = async (query: string = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      params.set('page_size', '40')

      const response = await fetch(`/api/ravelry/patterns?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch patterns from Ravelry')
      }

      const data = await response.json()

      // Transform Ravelry pattern data to our Project type
      const transformedProjects: Project[] = data.patterns?.map((pattern: any) => ({
        id: pattern.id?.toString() || '',
        name: pattern.name || 'Untitled Pattern',
        pattern: pattern.name || 'Untitled Pattern',
        patternUrl: pattern.permalink ? `https://www.ravelry.com/patterns/library/${pattern.permalink}` : undefined,
        imageUrl: pattern.first_photo?.medium_url || pattern.first_photo?.small_url || undefined,
        status: 'queued' as const,
        designer: pattern.designer?.name || undefined,
        difficulty: mapRavelryDifficulty(pattern.difficulty_average),
        yarn: [], // We'd need to fetch pattern details for yarn info
        ravelryId: pattern.id,
        notes: pattern.notes_html ? stripHtml(pattern.notes_html) : undefined,
      })) || []

      setProjects(transformedProjects)
    } catch (err) {
      console.error('Error fetching patterns:', err)
      setError('Failed to load patterns from Ravelry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchPatterns(searchQuery)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleAddToQueue = (projectId: string) => {
    console.log('Add project to queue:', projectId)
    // TODO: Implement in Phase 2 with database
    alert('This feature will be available once database integration is added!')
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Explore Patterns
          </h1>
          <p className="text-foreground/70">
            Discover thousands of knitting patterns from Ravelry
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Search patterns (try 'sweater', 'socks', 'shawl')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
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

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4 animate-bounce">🧶</div>
            <p className="text-foreground/70">Loading patterns from Ravelry...</p>
          </div>
        ) : (
          /* Projects Grid */
          <ProjectGrid
            projects={projects}
            showAddButton={true}
            onAdd={handleAddToQueue}
            emptyMessage="No patterns found. Try a different search!"
          />
        )}
      </main>
    </div>
  )
}

// Helper function to map Ravelry difficulty to our scale
function mapRavelryDifficulty(avg: number | undefined): 'beginner' | 'easy' | 'intermediate' | 'advanced' | undefined {
  if (!avg) return undefined
  if (avg <= 2) return 'beginner'
  if (avg <= 4) return 'easy'
  if (avg <= 7) return 'intermediate'
  return 'advanced'
}

// Helper function to strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').substring(0, 150)
}
