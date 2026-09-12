import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Resolving the caller for an API route.
 *
 * `supabase.auth.getUser()` is not a local check — it makes a network call to
 * GET /auth/v1/user, and Supabase puts that endpoint in the same bucket as
 * sign-up/sign-in: 30 requests per 5 minutes per IP. Calling it once per API
 * request blows that budget during ordinary use. The upload poller alone asks
 * for job status every couple of seconds, so a single pattern extraction used
 * to spend the whole five-minute allowance inside the first minute, and every
 * authenticated request from that IP then failed with "Request rate limit
 * reached" until the window rolled over.
 *
 * So validate a given access token over the network once and reuse the answer
 * for a short spell. The token is signed and carries its own expiry, the
 * window is small, and Postgres RLS — not this function — is what actually
 * guards the rows, so a session revoked mid-window is bounded by TTL rather
 * than able to read anything it could not read a minute ago.
 */
const VALIDATION_TTL_MS = 60_000

// Bounds memory on a long-lived server. Well past a single user's needs; it
// exists so a burst of distinct tokens cannot grow the map without limit.
const MAX_CACHED_TOKENS = 1000

const validated = new Map<string, { userId: string; expiresAt: number }>()

// Tokens are bearer credentials, so key the cache by digest rather than
// holding the raw JWTs in memory for the life of the process.
function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

function remember(key: string, userId: string, expiresAt: number): void {
  if (validated.size >= MAX_CACHED_TOKENS) {
    // A cache, not a source of truth — dropping the oldest half is fine, and
    // costs at most one extra /auth/v1/user call for the entries evicted.
    const stale = [...validated.keys()].slice(0, Math.floor(MAX_CACHED_TOKENS / 2))
    for (const k of stale) validated.delete(k)
  }
  validated.set(key, { userId, expiresAt })
}

export interface RequestUser {
  /** Request-scoped client, already carrying the caller's session. */
  supabase: SupabaseClient
  /** `null` when the request has no usable session — answer 401. */
  userId: string | null
}

/**
 * Build a server client and resolve the calling user's id.
 *
 * Replaces the `createServerClient()` + `auth.getUser()` pair that every route
 * used to repeat. Routes only ever needed `user.id`, so that is all this
 * returns; ask Supabase directly if a route ever needs the full user record.
 */
export async function getRequestUser(): Promise<RequestUser> {
  const supabase = createServerClient()

  // Local: parses the session cookie through the storage adapter. Only
  // getUser() goes to the network, and only `access_token`/`expires_at` are
  // read here — touching `session.user` would trip auth-js's insecure-user
  // warning on every request.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token
  if (!token) return { supabase, userId: null }

  const key = fingerprint(token)
  const now = Date.now()

  const cached = validated.get(key)
  if (cached && cached.expiresAt > now) {
    return { supabase, userId: cached.userId }
  }
  validated.delete(key)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return { supabase, userId: null }

  // Never vouch for a token past the expiry it carries itself.
  const tokenExpiresAt = session?.expires_at
    ? session.expires_at * 1000
    : Number.POSITIVE_INFINITY
  remember(key, user.id, Math.min(now + VALIDATION_TTL_MS, tokenExpiresAt))

  return { supabase, userId: user.id }
}
