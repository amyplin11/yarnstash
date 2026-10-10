'use client'

import { useSyncExternalStore } from 'react'

// Per-device preference: whether Follow Mode reads each step as you reach it.
const STORAGE_KEY = 'yarnstash:auto-read'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
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
    // Storage can be unavailable (private mode, blocked cookies) — default off.
    return false
  }
}

function serverSnapshot() {
  return false
}

export function useAutoRead() {
  return useSyncExternalStore(subscribe, read, serverSnapshot)
}

export function toggleAutoRead() {
  const next = !read()
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    // Non-persistent toggle is still better than an unresponsive switch.
  }
  for (const listener of listeners) listener()
}
