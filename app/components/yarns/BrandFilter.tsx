'use client'

import { useEffect, useRef, useState } from 'react'
import type { YarnBrand, YarnBrandResult } from '@/lib/types'
import { Button } from '@/app/components/ui/Button'

const DEBOUNCE_MS = 200
const RESULT_LIMIT = 30

interface BrandFilterProps {
  /** Exact company names currently applied */
  selected: string[]
  onChange: (brands: string[]) => void
}

export function BrandFilter({ selected, onChange }: BrandFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [brands, setBrands] = useState<YarnBrand[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Runs on mount with an empty query, which both fills the popular-brand list
  // and warms the server-side brand index before the user starts typing.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const trimmed = query.trim()
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: RESULT_LIMIT.toString() })
        if (trimmed) params.set('q', trimmed)

        const response = await fetch(`/api/yarns/brands?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load brands')
        }

        const data: YarnBrandResult = await response.json()
        if (cancelled) return

        setBrands(data.brands || [])
        setTotal(data.total || 0)
        setError(null)
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setBrands([])
        setError('Could not load brands.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, trimmed ? DEBOUNCE_MS : 0)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const toggleBrand = (name: string) => {
    onChange(
      selected.includes(name) ? selected.filter((brand) => brand !== name) : [...selected, name]
    )
  }

  const label =
    selected.length === 0
      ? 'All Brands'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} brands`

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="relative inline-block">
        <Button
          variant={selected.length > 0 ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setOpen((current) => !current)}
          className="max-w-xs"
        >
          <span className="truncate min-w-0">{label}</span>
          <span aria-hidden="true" className="ml-2 text-xs">
            ▾
          </span>
        </Button>

        {open && (
          <div className="absolute z-20 mt-1 w-80 rounded-lg border border-foreground/20 bg-background shadow-lg">
            <div className="p-2 border-b border-foreground/10">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false)
                }}
                placeholder={
                  total > 0 ? `Search ${total.toLocaleString()} brands...` : 'Search brands...'
                }
                className="w-full px-3 py-2 rounded border border-foreground/20 bg-background text-foreground text-sm placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto py-1">
              {loading ? (
                <p className="px-3 py-2 text-sm text-foreground/60">Loading brands...</p>
              ) : error ? (
                <p className="px-3 py-2 text-sm text-foreground/60">{error}</p>
              ) : brands.length === 0 ? (
                <p className="px-3 py-2 text-sm text-foreground/60">No brands match that search.</p>
              ) : (
                brands.map((brand) => {
                  const isSelected = selected.includes(brand.name)

                  return (
                    <label
                      key={brand.name}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-foreground/5"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBrand(brand.name)}
                        className="accent-teal-600"
                      />
                      <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                        {brand.name}
                      </span>
                      <span className="text-xs text-foreground/50 shrink-0">
                        {brand.count.toLocaleString()}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {selected.length > 0 && (
              <div className="p-2 border-t border-foreground/10">
                <Button variant="secondary" size="sm" onClick={() => onChange([])} className="w-full">
                  Clear brand filter
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected brands stay visible and removable even when the popover is shut. */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => toggleBrand(brand)}
              className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-900 dark:text-teal-100 text-xs hover:bg-teal-200 dark:hover:bg-teal-900/70"
              aria-label={`Remove ${brand} filter`}
            >
              <span className="truncate">{brand}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
