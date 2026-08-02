'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { Badge } from '@/app/components/ui/Badge'
import { Pattern } from '@/lib/types/pattern'

export default function PatternsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchPatterns()
    }
  }, [user])

  const fetchPatterns = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/patterns')
      if (!response.ok) throw new Error('Failed to fetch patterns')

      const data = await response.json()
      setPatterns(data.patterns || [])
    } catch (err) {
      console.error('Error fetching patterns:', err)
      setError('Failed to load patterns')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, patternId: string, patternName: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(`Delete "${patternName}"? This cannot be undone.`)) return

    setDeletingId(patternId)
    try {
      const response = await fetch(`/api/patterns/${patternId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete pattern')
      }
      setPatterns((prev) => prev.filter((p) => p.id !== patternId))
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete pattern')
    } finally {
      setDeletingId(null)
    }
  }

  // A pattern counts as a current project while it has progress that isn't finished.
  const inProgress = patterns
    .filter((p) => p.progress && !p.progress.completed_at)
    .sort(
      (a, b) =>
        new Date(b.progress?.last_worked_at ?? 0).getTime() -
        new Date(a.progress?.last_worked_at ?? 0).getTime()
    )
  const inProgressIds = new Set(inProgress.map((p) => p.id))
  // The rest of the library, so nothing is listed twice.
  const restOfLibrary = patterns.filter((p) => !inProgressIds.has(p.id))

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📄</div>
          <p className="text-foreground/70">Loading patterns...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-display text-5xl tracking-tight text-ink mb-3">
              My Patterns
            </h1>
            <p className="text-foreground/70">
              Your uploaded knitting patterns with AI-extracted instructions
            </p>
          </div>
          <Link href="/patterns/upload">
            <Button variant="primary" size="lg">
              <span className="mr-2">➕</span>
              Upload Pattern
            </Button>
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 mb-8 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-sm text-foreground/90">{error}</p>
            </div>
          </Card>
        )}

        {/* Current projects — patterns with an open progress row, most recent first */}
        {patterns.length > 0 && (
          <section className="mb-14">
            <div className="mb-6">
              <p className="mb-3 flex items-center gap-4 text-terracotta">
                <span className="h-px w-10 bg-terracotta" aria-hidden="true" />
                <span className="eyebrow">On the needles</span>
              </p>
              <h2 className="font-display text-4xl tracking-tight text-ink">Current Projects</h2>
            </div>

            {inProgress.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-foreground/70">
                  Nothing on the needles yet. Open a pattern and start tracking rows — it will
                  show up here.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map((pattern) => (
                  <Link key={pattern.id} href={`/patterns/${pattern.id}`}>
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
                        {pattern.progress?.selected_size && (
                          <div className="flex gap-2">
                            <dt>Size</dt>
                            <dd className="font-medium text-parchment">
                              {pattern.progress.selected_size}
                            </dd>
                          </div>
                        )}
                        {pattern.progress?.row_counter !== undefined && (
                          <div className="flex gap-2">
                            <dt>Row</dt>
                            <dd className="font-medium text-parchment">
                              {pattern.progress.row_counter}
                            </dd>
                          </div>
                        )}
                        {pattern.progress?.completed_instructions?.length ? (
                          <div className="flex gap-2">
                            <dt>Steps done</dt>
                            <dd className="font-medium text-parchment">
                              {pattern.progress.completed_instructions.length}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      <div className="mt-6 flex items-center justify-between border-t border-parchment/20 pt-4 text-sm">
                        <span className="text-parchment/70">
                          {pattern.progress?.last_worked_at
                            ? `Last worked ${new Date(pattern.progress.last_worked_at).toLocaleDateString()}`
                            : 'Just started'}
                        </span>
                        <span className="font-medium">Resume →</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Patterns Grid */}
        {patterns.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No patterns yet
            </h2>
            <p className="text-foreground/70 mb-6">
              Upload your first knitting pattern to get started!
            </p>
            <Link href="/patterns/upload">
              <Button variant="primary" size="lg">
                Upload Pattern
              </Button>
            </Link>
          </Card>
        ) : restOfLibrary.length === 0 ? null : (
          <section>
            <h2 className="font-display text-4xl tracking-tight text-ink mb-6">
              {inProgress.length > 0 ? 'The Rest of the Library' : 'All Patterns'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {restOfLibrary.map((pattern) => (
              <Link key={pattern.id} href={`/patterns/${pattern.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold text-foreground">
                      {pattern.name}
                    </h3>
                    <span className="text-2xl">📄</span>
                  </div>

                  {pattern.designer && (
                    <p className="text-sm text-foreground/70 mb-2">
                      by {pattern.designer}
                    </p>
                  )}

                  {pattern.difficulty && (
                    <div className="mb-3">
                      <Badge variant="secondary" text={pattern.difficulty} />
                    </div>
                  )}

                  {pattern.pattern_type && (
                    <p className="text-sm text-foreground/60 mb-3">
                      {pattern.pattern_type}
                    </p>
                  )}

                  <div className="mt-auto pt-4 border-t border-foreground/10 flex items-center justify-between">
                    <p className="text-xs text-foreground/50">
                      Uploaded {new Date(pattern.created_at!).toLocaleDateString()}
                    </p>
                    <button
                      onClick={(e) => handleDelete(e, pattern.id, pattern.name)}
                      disabled={deletingId === pattern.id}
                      className="text-xs text-foreground/40 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete pattern"
                    >
                      {deletingId === pattern.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </Card>
              </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
