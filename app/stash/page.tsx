'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StashYarn } from '@/lib/types'
import { YarnGrid } from '@/app/components/yarns/YarnGrid'
import { YarnTable } from '@/app/components/yarns/YarnTable'
import { AddYarnDialog } from '@/app/components/yarns/AddYarnDialog'
import { StashEntryDialog } from '@/app/components/yarns/StashEntryDialog'
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

/** Lightest to heaviest — the order a knitter expects, not alphabetical. */
const WEIGHT_ORDER: YarnWeight[] = [
  'lace',
  'fingering',
  'sport',
  'dk',
  'worsted',
  'aran',
  'bulky',
  'super-bulky',
  'jumbo',
]

const filterLabelStyles = 'text-xs font-semibold uppercase tracking-wider text-ink-soft'
const filterSelectStyles =
  'rounded-full border border-line bg-surface px-4 py-2 text-sm capitalize text-ink transition-colors hover:border-line-strong focus:border-terracotta focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export default function StashPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stashYarns, setStashYarns] = useState<StashYarn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weightFilter, setWeightFilter] = useState<YarnWeight | 'all'>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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

  // Both dropdowns are built from the stash itself, not the catalog — they
  // should only ever offer something the user actually owns, so no choice can
  // lead to an empty result. Both derive from the full stash rather than from
  // each other's filtered subset, so using one doesn't make the other's
  // options vanish mid-selection.
  const brands = Array.from(
    new Set(
      stashYarns
        .map((stashYarn) => stashYarn.yarn.brand?.trim())
        .filter((brand): brand is string => Boolean(brand))
    )
  ).sort((a, b) => a.localeCompare(b))

  // Weights keep their natural lace-to-jumbo order rather than sorting
  // alphabetically, which would read as nonsense to a knitter.
  const weights = WEIGHT_ORDER.filter((weight) =>
    stashYarns.some((stashYarn) => stashYarn.yarn.weight === weight)
  )

  const countByBrand = (brand: string) =>
    stashYarns.filter((s) => s.yarn.brand?.trim() === brand).length
  const countByWeight = (weight: YarnWeight) =>
    stashYarns.filter((s) => s.yarn.weight === weight).length

  const filteredStash = stashYarns.filter((stashYarn) => {
    if (weightFilter !== 'all' && stashYarn.yarn.weight !== weightFilter) return false
    if (brandFilter !== 'all' && stashYarn.yarn.brand?.trim() !== brandFilter) return false
    return true
  })

  // A brand or weight that no longer exists in the stash (its last skein was
  // deleted) would otherwise filter everything out with no way back.
  useEffect(() => {
    if (brandFilter !== 'all' && !brands.includes(brandFilter)) {
      setBrandFilter('all')
    }
  }, [brands, brandFilter])

  useEffect(() => {
    if (weightFilter !== 'all' && !weights.includes(weightFilter)) {
      setWeightFilter('all')
    }
  }, [weights, weightFilter])

  const editingEntry = stashYarns.find((stashYarn) => stashYarn.id === editingId) ?? null

  // "Your stash is empty" is a lie when a filter is what emptied the view.
  const filtering = weightFilter !== 'all' || brandFilter !== 'all'
  const emptyMessage =
    stashYarns.length > 0 && filtering
      ? 'No yarns match these filters.'
      : 'Your stash is empty.'

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

        {/*
          Filters, with the card/table switch trailing them. Both dropdowns
          render whenever the stash has anything in it — an earlier version
          hid the brand filter unless there were two or more brands, which
          just made it look missing.
        */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="weight-filter" className={filterLabelStyles}>
                Weight
              </label>
              <select
                id="weight-filter"
                value={weightFilter}
                onChange={(e) => setWeightFilter(e.target.value as YarnWeight | 'all')}
                disabled={stashYarns.length === 0}
                className={filterSelectStyles}
              >
                <option value="all">All weights ({stashYarns.length})</option>
                {weights.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight} ({countByWeight(weight)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="brand-filter" className={filterLabelStyles}>
                Brand
              </label>
              <select
                id="brand-filter"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                disabled={stashYarns.length === 0}
                className={filterSelectStyles}
              >
                <option value="all">All brands ({stashYarns.length})</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand} ({countByBrand(brand)})
                  </option>
                ))}
              </select>
            </div>

            {filtering && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setWeightFilter('all')
                  setBrandFilter('all')
                }}
              >
                Clear filters
              </Button>
            )}
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
            onSelect={setEditingId}
            emptyMessage={emptyMessage}
          />
        ) : (
          <YarnGrid
            yarns={filteredStash}
            editable={true}
            onDelete={handleDelete}
            onSelect={setEditingId}
            emptyMessage={emptyMessage}
          />
        )}

        <AddYarnDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={fetchStash}
        />

        <StashEntryDialog
          entry={editingEntry}
          onClose={() => setEditingId(null)}
          onChanged={fetchStash}
        />
      </main>
    </div>
  )
}
