import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client. Bypasses RLS — every query MUST scope by
// user_id explicitly.
//
// This exists for background work scheduled with `after()`: that code runs
// once the HTTP response has already been sent, so `createServerClient()` is
// not usable there (it reads auth from `next/headers` cookies, which are only
// available during the request).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for background pattern extraction'
    )
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
