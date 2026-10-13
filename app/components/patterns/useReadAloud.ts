'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ReadAloudStatus = 'idle' | 'loading' | 'playing' | 'error'

export interface VoiceOption {
  id: string
  name: string
  description: string
}

/**
 * Playback for Follow Mode's read-aloud. Fetches audio from /api/tts and plays
 * it through a single <audio> element, so speaking again always cuts off the
 * previous row rather than stacking voices.
 */
export function useReadAloud() {
  const [status, setStatus] = useState<ReadAloudStatus>('idle')
  // null until /api/tts says whether ElevenLabs is configured.
  const [available, setAvailable] = useState<boolean | null>(null)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Per-tab cache, keyed by voice + text, so Previous → Next replays without a request.
  const cacheRef = useRef(new Map<string, string>())
  // Bumped by every speak()/stop(); a response for an older ticket is stale.
  const ticketRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tts')
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((result) => {
        if (cancelled) return
        setAvailable(Boolean(result.enabled))
        setVoices(result.voices ?? [])
        setDefaultVoiceId(result.defaultVoiceId ?? null)
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const urls = cacheRef.current
    return () => {
      audioRef.current?.pause()
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const stop = useCallback(() => {
    ticketRef.current++
    audioRef.current?.pause()
    setStatus('idle')
  }, [])

  /** Speak `text`; `voiceId` null means the server's default voice. */
  const speak = useCallback(async (text: string, voiceId: string | null = null) => {
    const ticket = ++ticketRef.current
    audioRef.current?.pause()

    const cacheKey = `${voiceId ?? ''}\0${text}`
    let url = cacheRef.current.get(cacheKey)
    if (!url) {
      setStatus('loading')
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(voiceId ? { text, voiceId } : { text }),
        })
        if (!res.ok) {
          if (res.status === 503) setAvailable(false)
          throw new Error(`Read-aloud failed (${res.status})`)
        }
        url = URL.createObjectURL(await res.blob())
        // Cache even if stale — it was paid for, and Previous may want it.
        cacheRef.current.set(cacheKey, url)
      } catch (err) {
        console.error(err)
        if (ticket === ticketRef.current) setStatus('error')
        return
      }
    }

    // The knitter moved on while this was loading — don't talk over them.
    if (ticket !== ticketRef.current) return

    const audio = (audioRef.current ??= new Audio())
    audio.src = url
    audio.onended = () => {
      if (ticket === ticketRef.current) setStatus('idle')
    }
    try {
      await audio.play()
      if (ticket === ticketRef.current) setStatus('playing')
    } catch {
      // Autoplay blocked (no user gesture since load, e.g. after ?resume=1).
      // Going back to idle leaves the 🔊 button ready for that one tap.
      if (ticket === ticketRef.current) setStatus('idle')
    }
  }, [])

  return { speak, stop, status, available, voices, defaultVoiceId }
}
