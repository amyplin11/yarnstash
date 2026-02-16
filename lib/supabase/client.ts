import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
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
