import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Server-side Supabase client that reads auth from cookies
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const cookieStore = cookies()

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: {
        getItem: async (key: string) => {
          const cookie = (await cookieStore).get(key)
          return cookie?.value
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
