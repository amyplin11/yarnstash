'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useUpload } from '@/lib/upload/UploadContext'

/**
 * How many patterns the nav badge should show.
 *
 * Returns 0 for signed-out visitors, while the first fetch is in flight, and if
 * that fetch fails — the badge is decoration, so a hiccup should hide the count
 * rather than break the nav. A finished upload adds a pattern, so the count is
 * refetched whenever one lands.
 */
export function usePatternCount() {
  const { user } = useAuth()
  const { status } = useUpload()
  const [count, setCount] = useState(0)
  const uploadFinished = status === 'success'

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/patterns')
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setCount(Array.isArray(data.patterns) ? data.patterns.length : 0)
        }
      } catch {
        // Keep the last known count rather than flashing the badge away.
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, uploadFinished])

  return user ? count : 0
}
