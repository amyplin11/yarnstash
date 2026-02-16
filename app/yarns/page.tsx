'use client'

import { useState, useEffect } from 'react'
import { Yarn } from '@/lib/types'
import { YarnGrid } from '@/app/components/yarns/YarnGrid'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

export default function YarnsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [yarns, setYarns] = useState<Yarn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchYarns()
  }, [])

  const fetchYarns = async (query: string = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      params.set('page_size', '40')

      const response = await fetch(`/api/ravelry/yarns?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch yarns from Ravelry')
      }

      const data = await response.json()

      // Transform Ravelry yarn data to our Yarn type
      const transformedYarns: Yarn[] = data.yarns?.map((ravelryYarn: any) => ({
        id: ravelryYarn.id?.toString() || '',
        brand: ravelryYarn.yarn_company_name || 'Unknown Brand',
        name: ravelryYarn.name || 'Unknown Yarn',
        weight: mapRavelryWeight(ravelryYarn.yarn_weight?.name),
        fiberContent: ravelryYarn.yarn_fibers?.map((f: any) => f.fiber_type?.name).join(', ') || 'Unknown',
        yardage: ravelryYarn.yardage || 0,
        gramsPerSkein: ravelryYarn.grams || 0,
        price: undefined, // Ravelry doesn't provide pricing
        imageUrl: ravelryYarn.first_photo?.small_url || undefined,
        colors: [], // Ravelry doesn't provide color data in search results
      })) || []

      setYarns(transformedYarns)
    } catch (err) {
      console.error('Error fetching yarns:', err)
      setError('Failed to load yarns from Ravelry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
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
          colorway: 'Default', // User can edit later
          weight: yarn.weight,
          fiber_content: yarn.fiberContent,
          yardage: yarn.yardage,
          grams_per_skein: yarn.gramsPerSkein,
          skeins: 1, // Default to 1 skein
          image_url: yarn.imageUrl,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add yarn to stash')
      }

      alert(`✅ ${yarn.brand} ${yarn.name} added to your stash!`)
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
            Browse thousands of yarns from the Ravelry database
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Search by brand or yarn name..."
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
            <p className="text-foreground/70">Loading yarns from Ravelry...</p>
          </div>
        ) : (
          /* Yarns Grid */
          <YarnGrid
            yarns={yarns}
            showAddButton={true}
            onAdd={handleAddToStash}
            emptyMessage="No yarns found. Try a different search!"
          />
        )}
      </main>
    </div>
  )
}

// Helper function to map Ravelry weight names to our YarnWeight type
function mapRavelryWeight(ravelryWeight: string | undefined): any {
  if (!ravelryWeight) return 'worsted'

  const weight = ravelryWeight.toLowerCase()
  if (weight.includes('lace')) return 'lace'
  if (weight.includes('fingering') || weight.includes('sock')) return 'fingering'
  if (weight.includes('sport') || weight.includes('baby')) return 'sport'
  if (weight.includes('dk') || weight.includes('light')) return 'dk'
  if (weight.includes('worsted') || weight.includes('afghan')) return 'worsted'
  if (weight.includes('aran')) return 'aran'
  if (weight.includes('bulky') || weight.includes('chunky')) return 'bulky'
  if (weight.includes('super bulky')) return 'super-bulky'
  if (weight.includes('jumbo')) return 'jumbo'

  return 'worsted' // default
}
