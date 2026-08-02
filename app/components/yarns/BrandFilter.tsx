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
          <div className="absolute z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgba(28,26,23,0.55)]">
            <div className="p-2 border-b border-line">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false)
                }}
                placeholder={
                  total > 0 ? `Search ${total.toLocaleString()} brands…` : 'Search brands…'
                }
                className="w-full rounded-xl border border-line-strong bg-parchment px-3 py-2 text-sm text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>

            <div className="max-h-72 overflow-y-auto py-1">
              {loading ? (
                <p className="px-3 py-2 text-sm text-ink-soft">Loading brands…</p>
              ) : error ? (
                <p className="px-3 py-2 text-sm text-ink-soft">{error}</p>
              ) : brands.length === 0 ? (
                <p className="px-3 py-2 text-sm text-ink-soft">No brands match that search.</p>
              ) : (
                brands.map((brand) => {
                  const isSelected = selected.includes(brand.name)

                  return (
                    <label
                      key={brand.name}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-parchment"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBrand(brand.name)}
                        className="accent-terracotta"
                      />
                      <span className="flex-1 min-w-0 truncate text-sm text-ink">
                        {brand.name}
                      </span>
                      <span className="text-xs text-ink-soft shrink-0">
                        {brand.count.toLocaleString()}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {selected.length > 0 && (
              <div className="p-2 border-t border-line">
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
              className="inline-flex items-center gap-1.5 max-w-full rounded-full bg-terracotta-soft px-3 py-1 text-xs font-medium text-terracotta-deep transition-colors hover:bg-terracotta hover:text-parchment"
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
