/**
 * The ElevenLabs voices read-aloud can use. Server-only — it needs the API key.
 *
 * The list doubles as an allowlist: /api/tts only synthesizes with a voice
 * that appears here, so a client cannot point our credits at arbitrary voices.
 */

export interface VoiceOption {
  id: string
  /** "Alice" */
  name: string
  /** "Clear, Engaging Educator · British · female" */
  description: string
}

// "Alice - Clear, Engaging Educator" — a premade voice ElevenLabs offers every
// account. Override with ELEVENLABS_VOICE_ID.
export const FALLBACK_VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'

export function defaultVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || FALLBACK_VOICE_ID
}

// The voice library changes rarely; an hour keeps the picker current without
// a lookup on every request.
const VOICES_TTL_MS = 60 * 60 * 1000

let cached: { voices: VoiceOption[]; expiresAt: number } | null = null

interface ElevenLabsVoice {
  voice_id: string
  name: string
  labels?: Record<string, string>
}

function toOption(voice: ElevenLabsVoice): VoiceOption {
  // Premade names carry their tagline after a dash: "Alice - Clear, Engaging Educator".
  const [name, ...tagline] = voice.name.split(' - ')
  const labels = voice.labels ?? {}
  const description = [tagline.join(' - '), labels.accent, labels.gender]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ')
  return { id: voice.voice_id, name: name.trim(), description }
}

export async function listVoices(apiKey: string): Promise<VoiceOption[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.voices

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    console.error(`ElevenLabs voice list failed (${res.status}):`, await res.text())
    // Not cached, so the next request tries again.
    return []
  }

  const body = (await res.json()) as { voices?: ElevenLabsVoice[] }
  const voices = (body.voices ?? [])
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name))
  cached = { voices, expiresAt: Date.now() + VOICES_TTL_MS }
  return voices
}

/** Whether `voiceId` may be used — listed, or the configured default. */
export async function isAllowedVoice(apiKey: string, voiceId: string): Promise<boolean> {
  if (voiceId === defaultVoiceId()) return true
  const voices = await listVoices(apiKey)
  return voices.some((v) => v.id === voiceId)
}
