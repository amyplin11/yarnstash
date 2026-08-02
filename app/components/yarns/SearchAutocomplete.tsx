'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { YarnBrand, YarnSuggestion, YarnSuggestionResult } from '@/lib/types'
import { Button } from '@/app/components/ui/Button'

const DEBOUNCE_MS = 200
const MIN_QUERY_LENGTH = 2

type Option =
  | { kind: 'brand'; key: string; brand: YarnBrand }
  | { kind: 'yarn'; key: string; yarn: YarnSuggestion }

interface SearchAutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  /** Run the free-text search for the current value */
  onSearch: () => void
  onSelectBrand: (brand: string) => void
  onSelectYarn: (yarn: YarnSuggestion) => void
  searching?: boolean
}

const EMPTY: YarnSuggestionResult = { brands: [], yarns: [] }

export function SearchAutocomplete({
  value,
  onValueChange,
  onSearch,
  onSelectBrand,
  onSelectYarn,
  searching = false,
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<YarnSuggestionResult>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const options = useMemo<Option[]>(
    () => [
      ...suggestions.brands.map((brand) => ({
        kind: 'brand' as const,
        key: `brand:${brand.name}`,
        brand,
      })),
      ...suggestions.yarns.map((yarn) => ({
        kind: 'yarn' as const,
        key: `yarn:${yarn.id}`,
        yarn,
      })),
    ],
    [suggestions]
  )

  const trimmed = value.trim()
  const queryIsLongEnough = trimmed.length >= MIN_QUERY_LENGTH

  // Fetch suggestions, debounced. Closing the dropdown cancels in-flight work,
  // which is also what stops a refetch after picking a suggestion.
  useEffect(() => {
    if (!open || !queryIsLongEnough) {
      setSuggestions(EMPTY)
      setLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/yarns/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load suggestions')
        }

        const data: YarnSuggestionResult = await response.json()
        if (cancelled) return

        setSuggestions({ brands: data.brands || [], yarns: data.yarns || [] })
        setHighlight(-1)
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') return
        // Suggestions are an enhancement — searching still works without them.
        setSuggestions(EMPTY)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [trimmed, queryIsLongEnough, open])

  // Close when clicking anywhere outside the combobox.
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

  // Keep the keyboard-highlighted row visible.
  useEffect(() => {
    if (highlight >= 0) {
      optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlight])

  const selectOption = (option: Option) => {
    setOpen(false)
    setHighlight(-1)
    setSuggestions(EMPTY)

    if (option.kind === 'brand') {
      onSelectBrand(option.brand.name)
    } else {
      onSelectYarn(option.yarn)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) {
          setOpen(true)
        } else if (options.length > 0) {
          setHighlight((current) => (current + 1) % options.length)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (options.length > 0) {
          setHighlight((current) => (current <= 0 ? options.length - 1 : current - 1))
        }
        break
      case 'Enter':
        if (open && highlight >= 0 && options[highlight]) {
          event.preventDefault()
          selectOption(options[highlight])
        } else {
          setOpen(false)
          onSearch()
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlight(-1)
        break
    }
  }

  const showDropdown = open && queryIsLongEnough
  const showEmptyState = !loading && options.length === 0

  const renderOption = (option: Option, index: number) => {
    const isHighlighted = index === highlight

    return (
      <li
        key={option.key}
        id={`yarn-suggestion-${index}`}
        role="option"
        aria-selected={isHighlighted}
        ref={(element) => {
          optionRefs.current[index] = element
        }}
        onMouseEnter={() => setHighlight(index)}
        // Keep focus in the input so the dropdown does not close before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => selectOption(option)}
        className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
          isHighlighted ? 'bg-teal-50 dark:bg-teal-950/40' : ''
        }`}
      >
        {option.kind === 'brand' ? (
          <>
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
              {option.brand.name}
            </span>
            <span className="text-xs text-foreground/50 shrink-0">
              {option.brand.count.toLocaleString()} yarns
            </span>
          </>
        ) : (
          <>
            {option.yarn.imageUrl ? (
              <img
                src={option.yarn.imageUrl}
                alt=""
                className="w-9 h-9 rounded object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded bg-foreground/10 shrink-0" />
            )}
            <span className="flex-1 min-w-0">
              <span className="block truncate text-sm text-foreground">{option.yarn.name}</span>
              <span className="block truncate text-xs text-foreground/60">
                {option.yarn.brand || 'Unknown brand'}
              </span>
            </span>
            <span className="text-xs text-foreground/50 shrink-0">{option.yarn.weight}</span>
          </>
        )}
      </li>
    )
  }

  return (
    <div className="flex gap-2">
      <div ref={containerRef} className="relative flex-1">
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="yarn-search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            highlight >= 0 && options[highlight] ? `yarn-suggestion-${highlight}` : undefined
          }
          placeholder="Search by brand, yarn name, or fiber..."
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-foreground/20 bg-background shadow-lg overflow-hidden">
            {loading && options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-foreground/60">Searching...</p>
            ) : showEmptyState ? (
              <p className="px-4 py-3 text-sm text-foreground/60">
                No matches. Press Enter to search anyway.
              </p>
            ) : (
              <ul
                id="yarn-search-suggestions"
                role="listbox"
                aria-label="Yarn search suggestions"
                className="max-h-96 overflow-y-auto py-1"
              >
                {suggestions.brands.length > 0 && (
                  <li
                    role="presentation"
                    className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-foreground/50"
                  >
                    Filter by brand
                  </li>
                )}
                {suggestions.brands.map((_, index) => renderOption(options[index], index))}

                {suggestions.yarns.length > 0 && (
                  <li
                    role="presentation"
                    className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-foreground/50"
                  >
                    Yarns
                  </li>
                )}
                {suggestions.yarns.map((_, offset) => {
                  const index = suggestions.brands.length + offset
                  return renderOption(options[index], index)
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={() => {
          setOpen(false)
          onSearch()
        }}
        disabled={searching}
      >
        {searching ? 'Searching...' : 'Search'}
      </Button>
    </div>
  )
}
