'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'yarnstash:stash-view'

export type StashView = 'cards' | 'table'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // `storage` fires in the *other* tabs, so the choice follows the user around.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function read(): StashView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'table' ? 'table' : 'cards'
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — show cards.
    return 'cards'
  }
}

/** The server has no way to know the stored preference, so it renders cards. */
function serverSnapshot(): StashView {
  return 'cards'
}

export function useStashView() {
  return useSyncExternalStore(subscribe, read, serverSnapshot)
}

export function setStashView(view: StashView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // A switch that doesn't persist still beats an unresponsive button.
  }
  for (const listener of listeners) listener()
}
