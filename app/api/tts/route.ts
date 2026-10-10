import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { defaultVoiceId, isAllowedVoice, listVoices } from '@/lib/speech/voices'

/**
 * Read-aloud for Follow Mode — the only code that talks to ElevenLabs.
 * See docs/read-aloud-design.md.
 *
 * The audio is buffered rather than streamed through: the whole MP3 is needed
 * to cache it, and a spoken row is only ~20–50 KB.
 */

// Flash is ElevenLabs' low-latency, low-cost model. "Next" feeling instant
// matters more here than studio-quality narration.
const MODEL_ID = 'eleven_flash_v2_5'
const OUTPUT_FORMAT = 'mp3_44100_64'

// The longest real rows are a few hundred characters. The cap bounds what a
// single request can spend, since ElevenLabs bills per character.
const MAX_TEXT_LENGTH = 1500

/**
 * In-memory LRU of generated audio. ElevenLabs bills every generation, even
 * for identical text, and patterns repeat lines constantly ("Knit to end").
 *
 * It lives in this server process, so it is lost on every deploy, restart or
 * idle shutdown, and each concurrent instance has its own. That only costs a
 * regeneration — persisting to Supabase Storage is the planned fix.
 */
const MAX_CACHE_BYTES = 50 * 1024 * 1024
const cache = new Map<string, ArrayBuffer>()
let cacheBytes = 0

function cacheGet(key: string): ArrayBuffer | undefined {
  const audio = cache.get(key)
  if (audio) {
    // Re-insert so Map order tracks recency.
    cache.delete(key)
    cache.set(key, audio)
  }
  return audio
}

function cacheSet(key: string, audio: ArrayBuffer): void {
  if (audio.byteLength > MAX_CACHE_BYTES) return
  cache.set(key, audio)
  cacheBytes += audio.byteLength
  for (const [oldKey, oldAudio] of cache) {
    if (cacheBytes <= MAX_CACHE_BYTES) break
    cache.delete(oldKey)
    cacheBytes -= oldAudio.byteLength
  }
}

function audioResponse(audio: ArrayBuffer): Response {
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
}

/**
 * Whether read-aloud is configured, and which voices it can use. The UI hides
 * its controls when it isn't configured.
 */
export async function GET() {
  const { userId } = await getRequestUser()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ enabled: false, voices: [], defaultVoiceId: null })
  }
  return NextResponse.json({
    enabled: true,
    voices: await listVoices(apiKey),
    defaultVoiceId: defaultVoiceId(),
  })
}

export async function POST(request: Request) {
  try {
    // Without this the route is an open proxy spending our ElevenLabs credits.
    const { userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Read-aloud is not configured' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `text must be at most ${MAX_TEXT_LENGTH} characters` },
        { status: 413 }
      )
    }

    const voiceId =
      typeof body?.voiceId === 'string' && body.voiceId ? body.voiceId : defaultVoiceId()
    if (!(await isAllowedVoice(apiKey, voiceId))) {
      return NextResponse.json({ error: 'Unknown voice' }, { status: 400 })
    }

    const key = createHash('sha256').update(`${voiceId}\0${MODEL_ID}\0${text}`).digest('base64url')

    const cached = cacheGet(key)
    if (cached) return audioResponse(cached)

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: MODEL_ID }),
      }
    )

    if (!upstream.ok) {
      // Logged, never echoed — the upstream body can describe our account.
      console.error(`ElevenLabs TTS failed (${upstream.status}):`, await upstream.text())
      return NextResponse.json({ error: 'Text-to-speech failed' }, { status: 502 })
    }

    const audio = await upstream.arrayBuffer()
    cacheSet(key, audio)
    return audioResponse(audio)
  } catch (error) {
    console.error('Error in POST /api/tts:', error)
    return NextResponse.json({ error: 'Text-to-speech failed' }, { status: 500 })
  }
}
