'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StashYarn } from '@/lib/types'
import { YarnGrid } from '@/app/components/yarns/YarnGrid'
import { Card } from '@/app/components/ui/Card'
import { YarnWeight } from '@/lib/types'
import { Button } from '@/app/components/ui/Button'
import { useAuth } from '@/lib/auth/AuthContext'

export default function StashPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stashYarns, setStashYarns] = useState<StashYarn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightFilter, setWeightFilter] = useState<YarnWeight | 'all'>('all')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchStash()
    }
  }, [user])

  const fetchStash = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stash')

      if (!response.ok) {
        throw new Error('Failed to fetch stash')
      }

      const data = await response.json()

      // Transform Supabase data to StashYarn format
      const transformedYarns: StashYarn[] = data.yarns?.map((item: any) => ({
        id: item.id,
        yarn: {
          id: item.ravelry_yarn_id || item.id,
          brand: item.brand,
          name: item.name,
          weight: item.weight as YarnWeight,
          fiberContent: item.fiber_content || '',
          yardage: item.yardage || 0,
          gramsPerSkein: item.grams_per_skein || 0,
          price: item.purchase_price || undefined,
          imageUrl: item.image_url || undefined,
        },
        colorway: item.colorway || '',
        skeins: item.skeins,
        purchaseDate: item.purchase_date ? new Date(item.purchase_date) : undefined,
        purchasePrice: item.purchase_price,
        location: item.location,
        notes: item.notes,
      })) || []

      setStashYarns(transformedYarns)
    } catch (err) {
      console.error('Error fetching stash:', err)
      setError('Failed to load your stash. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (yarnId: string) => {
    if (!confirm('Are you sure you want to remove this yarn from your stash?')) {
      return
    }

    try {
      const response = await fetch(`/api/stash/${yarnId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete yarn')
      }

      // Refresh the stash
      await fetchStash()
    } catch (err) {
      console.error('Error deleting yarn:', err)
      alert('Failed to delete yarn from stash. Please try again.')
    }
  }

  const filteredStash = weightFilter === 'all'
    ? stashYarns
    : stashYarns.filter(stashYarn => stashYarn.yarn.weight === weightFilter)

  // Calculate stats
  const totalSkeins = stashYarns.reduce((sum, yarn) => sum + yarn.skeins, 0)
  const totalYardage = stashYarns.reduce(
    (sum, yarn) => sum + (yarn.yarn.yardage * yarn.skeins),
    0
  )
  const totalValue = stashYarns.reduce(
    (sum, yarn) => sum + (yarn.purchasePrice || 0),
    0
  )

  const weights: (YarnWeight | 'all')[] = [
    'all', 'lace', 'fingering', 'sport', 'dk', 'worsted', 'aran', 'bulky', 'super-bulky', 'jumbo'
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            My Yarn Stash
          </h1>
          <p className="text-foreground/70">
            Manage your personal yarn collection
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-foreground/70 mb-1">Total Skeins</div>
            <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              {totalSkeins}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-foreground/70 mb-1">Total Yardage</div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {totalYardage.toLocaleString()} yds
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-foreground/70 mb-1">Estimated Value</div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              ${totalValue.toFixed(2)}
            </div>
          </Card>
        </div>

        {/* Weight Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {weights.map((weight) => (
            <Button
              key={weight}
              variant={weightFilter === weight ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setWeightFilter(weight)}
            >
              {weight === 'all' ? 'All Weights' : weight}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4 animate-bounce">🧶</div>
            <p className="text-foreground/70">Loading your stash...</p>
          </div>
        ) : (
          /* Stash Grid */
          <YarnGrid
            yarns={filteredStash}
            editable={true}
            onDelete={handleDelete}
            emptyMessage="Your stash is empty. Browse yarns and add them to your stash!"
          />
        )}
      </main>
    </div>
  )
}
