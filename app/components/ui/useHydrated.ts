'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * False during the server render and the hydrating pass, true afterwards.
 * Lets a component defer to client-only truth (stored preferences, the current
 * date) without a setState-in-effect or a hydration mismatch.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}
