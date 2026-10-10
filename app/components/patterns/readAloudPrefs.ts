'use client'

import { useSyncExternalStore } from 'react'

// Per-device read-aloud preferences: whether Follow Mode reads each step as
// you reach it, and which voice reads it.
const AUTO_READ_KEY = 'yarnstash:auto-read'
const VOICE_KEY = 'yarnstash:read-aloud-voice'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — use defaults.
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // A non-persistent choice is still better than an unresponsive control.
  }
  for (const listener of listeners) listener()
}

export function useAutoRead() {
  return useSyncExternalStore(
    subscribe,
    () => read(AUTO_READ_KEY) === '1',
    () => false
  )
}

export function toggleAutoRead() {
  write(AUTO_READ_KEY, read(AUTO_READ_KEY) === '1' ? '0' : '1')
}

/** The stored voice id, or null for "the server's default". */
export function useVoicePreference() {
  return useSyncExternalStore(
    subscribe,
    () => read(VOICE_KEY),
    () => null
  )
}

export function setVoicePreference(voiceId: string) {
  write(VOICE_KEY, voiceId)
}
