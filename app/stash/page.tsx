'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StashYarn } from '@/lib/types'
import { YarnGrid } from '@/app/components/yarns/YarnGrid'
import { YarnTable } from '@/app/components/yarns/YarnTable'
import { AddYarnDialog } from '@/app/components/yarns/AddYarnDialog'
import { setStashView, useStashView } from '@/app/components/yarns/stashViewState'
import { Card } from '@/app/components/ui/Card'
import { YarnWeight } from '@/lib/types'
import { Button } from '@/app/components/ui/Button'
import { ViewToggle } from '@/app/components/ui/ViewToggle'
import { GridIcon, PlusIcon, TableIcon } from '@/app/components/ui/icons'
import { useAuth } from '@/lib/auth/AuthContext'

const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Cards', icon: GridIcon },
  { value: 'table' as const, label: 'Table', icon: TableIcon },
]

export default function StashPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stashYarns, setStashYarns] = useState<StashYarn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightFilter, setWeightFilter] = useState<YarnWeight | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const view = useStashView()

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

  const weights: (YarnWeight | 'all')[] = [
    'all', 'lace', 'fingering', 'sport', 'dk', 'worsted', 'aran', 'bulky', 'super-bulky', 'jumbo'
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl tracking-tight text-ink mb-3">
              My Yarn Stash
            </h1>
            <p className="text-foreground/70">
              Manage your personal yarn collection
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/yarns">
              <Button variant="secondary">Browse catalog</Button>
            </Link>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Add Yarn
            </Button>
          </div>
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

        {/* Weight filter, with the card/table switch trailing it */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
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
          <ViewToggle
            value={view}
            onChange={setStashView}
            options={VIEW_OPTIONS}
            label="Stash view"
          />
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4 animate-bounce">🧶</div>
            <p className="text-foreground/70">Loading your stash...</p>
          </div>
        ) : view === 'table' ? (
          <YarnTable
            yarns={filteredStash}
            editable={true}
            onDelete={handleDelete}
            emptyMessage="Your stash is empty."
          />
        ) : (
          <YarnGrid
            yarns={filteredStash}
            editable={true}
            onDelete={handleDelete}
            emptyMessage="Your stash is empty."
          />
        )}

        <AddYarnDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={fetchStash}
        />
      </main>
    </div>
  )
}
