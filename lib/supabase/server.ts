import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Server-side Supabase client that reads auth from cookies
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const cookieStore = cookies()

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      // This client is built fresh for every request and never disposed, so it
      // must not start any background work. auth-js gates its refresh ticker on
      // tab visibility in the browser, but outside one there is no
      // visibilitychange to gate on, so it runs the ticker unconditionally
      // ("in non-browser environments the refresh token ticker runs always").
      // Left on, every API request leaks a 30s setInterval that outlives the
      // response and keeps re-checking the session for the life of the server
      // process. Once enough of them accumulate and the access token nears
      // expiry they all fire POST /auth/v1/token at once — the same endpoint
      // signInWithPassword uses, capped at 150 requests per 5 minutes per IP —
      // and sign-in starts failing with "Request rate limit reached".
      //
      // Refreshing is the browser client's job (lib/supabase/client.ts); the
      // server only ever reads the token the request arrived with.
      autoRefreshToken: false,
      // Must stay on: it is what makes auth-js use the `storage` adapter below.
      // Turning it off swaps in an in-memory store, the cookie is never read,
      // and every authenticated route 401s.
      persistSession: true,
      // Nothing on the server hands back an OAuth redirect fragment to parse.
      detectSessionInUrl: false,
      storage: {
        getItem: async (key: string) => {
          const cookie = (await cookieStore).get(key)
          return cookie?.value ?? null
        },
        setItem: async (key: string, value: string) => {
          try {
            (await cookieStore).set(key, value, {
              maxAge: 60 * 60 * 24 * 7, // 1 week
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          } catch (error) {
            // Handle cookie setting errors (might occur in middleware)
          }
        },
        removeItem: async (key: string) => {
          try {
            (await cookieStore).delete(key)
          } catch (error) {
            // Handle cookie removal errors
          }
        },
      },
    },
  })
}
