'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'yarnstash:sidebar-collapsed'

/** Rail geometry, shared by the sidebar itself and everything that sits beside it. */
export const RAIL_WIDTH = { expanded: 280, collapsed: 88 }

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // `storage` fires in the *other* tabs, so a collapse follows the user around.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function read() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — just stay open.
    return false
  }
}

/** The server has no way to know the stored preference, so it always renders open. */
function serverSnapshot() {
  return false
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, read, serverSnapshot)
}

export function toggleSidebar() {
  const next = !read()
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    // Non-persistent toggle is still better than an unresponsive button.
  }
  for (const listener of listeners) listener()
}
