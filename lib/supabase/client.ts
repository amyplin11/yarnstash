import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!_supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables are not configured')
      }
      _supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          storage: {
            getItem: (key: string) => {
              if (typeof window === 'undefined') return null
              return document.cookie
                .split('; ')
                .find((row) => row.startsWith(`${key}=`))
                ?.split('=')[1] || null
            },
            setItem: (key: string, value: string) => {
              if (typeof window === 'undefined') return
              document.cookie = `${key}=${value}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${
                process.env.NODE_ENV === 'production' ? '; Secure' : ''
              }`
            },
            removeItem: (key: string) => {
              if (typeof window === 'undefined') return
              document.cookie = `${key}=; path=/; max-age=0`
            },
          },
        },
      })
    }
    return Reflect.get(_supabase, prop, receiver)
  },
})
