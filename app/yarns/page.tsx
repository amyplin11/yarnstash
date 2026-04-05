'use client'

import { useState, useEffect } from 'react'
import { Yarn, YarnWeight, YarnSearchResult, catalogYarnToYarn } from '@/lib/types'
import { YarnGrid } from '@/app/components/yarns/YarnGrid'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

const WEIGHT_OPTIONS: { label: string; value: YarnWeight | 'all' }[] = [
  { label: 'All Weights', value: 'all' },
  { label: 'Lace', value: 'lace' },
  { label: 'Fingering', value: 'fingering' },
  { label: 'Sport', value: 'sport' },
  { label: 'DK', value: 'dk' },
  { label: 'Worsted', value: 'worsted' },
  { label: 'Aran', value: 'aran' },
  { label: 'Bulky', value: 'bulky' },
  { label: 'Super Bulky', value: 'super-bulky' },
  { label: 'Jumbo', value: 'jumbo' },
]

export default function YarnsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [yarns, setYarns] = useState<Yarn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [weightFilter, setWeightFilter] = useState<YarnWeight | 'all'>('all')
  const [sort, setSort] = useState<string>('rating')

  useEffect(() => {
    fetchYarns()
  }, [page, weightFilter, sort])

  const fetchYarns = async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const q = query !== undefined ? query : searchQuery
      if (q) params.set('query', q)
      if (weightFilter !== 'all') params.set('weight', weightFilter)
      params.set('sort', sort)
      params.set('page', page.toString())
      params.set('page_size', '40')
      params.set('discontinued', 'false')

      const response = await fetch(`/api/yarns?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch yarns')
      }

      const data: YarnSearchResult = await response.json()
      setYarns(data.yarns.map(catalogYarnToYarn))
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (err) {
      console.error('Error fetching yarns:', err)
      setError('Failed to load yarns. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchYarns(searchQuery)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleAddToStash = async (yarnId: string) => {
    const yarn = yarns.find(y => y.id === yarnId)
    if (!yarn) return

    try {
      const response = await fetch('/api/stash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ravelry_yarn_id: yarnId,
          brand: yarn.brand,
          name: yarn.name,
          colorway: 'Default',
          weight: yarn.weight,
          fiber_content: yarn.fiberContent,
          yardage: yarn.yardage,
          grams_per_skein: yarn.gramsPerSkein,
          skeins: 1,
          image_url: yarn.imageUrl,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add yarn to stash')
      }

      alert(`${yarn.brand} ${yarn.name} added to your stash!`)
    } catch (error) {
      console.error('Error adding to stash:', error)
      alert('Failed to add yarn to stash. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Explore Yarns
          </h1>
          <p className="text-foreground/70">
            Browse thousands of yarns in the catalog
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Search by brand, yarn name, or fiber..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Weight Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {WEIGHT_OPTIONS.map(({ label, value }) => (
            <Button
              key={value}
              variant={weightFilter === value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setWeightFilter(value); setPage(1) }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Sort + Result count */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-foreground/60">
            {total.toLocaleString()} yarns found
          </p>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1) }}
            className="px-3 py-1.5 rounded border border-foreground/20 bg-background text-foreground text-sm"
          >
            <option value="rating">Highest Rated</option>
            <option value="name">Name A-Z</option>
            <option value="company">Brand A-Z</option>
            <option value="newest">Recently Added</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <Card className="p-4 mb-8 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <span className="text-2xl">!</span>
              <p className="text-sm text-foreground/90">{error}</p>
            </div>
          </Card>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-foreground/70">Loading yarns...</p>
          </div>
        ) : (
          <>
            <YarnGrid
              yarns={yarns}
              showAddButton={true}
              onAdd={handleAddToStash}
              emptyMessage="No yarns found. Try a different search!"
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-foreground/70">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
