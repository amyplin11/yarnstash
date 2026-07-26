'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

// Landing page for the link sent by resetPasswordForEmail().
//
// The link carries a recovery credential that Supabase exchanges for a short
// -lived session; once that session exists, updateUser({ password }) can set a
// new password. Both link formats are handled, since the client doesn't pin a
// flowType: PKCE arrives as ?code=..., implicit as a #access_token=... hash
// that detectSessionInUrl consumes on client init.

type Status = 'verifying' | 'ready' | 'invalid' | 'saved'

// Grace period for the implicit flow, where the hash is consumed
// asynchronously as the client initialises.
const VERIFY_TIMEOUT_MS = 3000

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let settled = false
    const succeed = () => {
      if (settled) return
      settled = true
      setStatus('ready')
    }

    // Fires PASSWORD_RECOVERY (or SIGNED_IN) once the link's credential has
    // been turned into a session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) succeed()
    })

    const init = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          if (!settled) {
            settled = true
            setStatus('invalid')
          }
          return
        }
        succeed()
        return
      }

      // Implicit flow: detectSessionInUrl may already have consumed the hash.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) succeed()
    }

    void init()

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        setStatus('invalid')
      }
    }, VERIFY_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
      } else {
        setStatus('saved')
        // The recovery session is a real session, so the user is now signed in.
        setTimeout(() => router.push('/stash'), 1500)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">🧶 YarnStash</h1>
          <p className="text-foreground/70">Choose a new password</p>
        </div>
        {children}
      </Card>
    </div>
  )

  if (status === 'verifying') {
    return shell(
      <p className="text-center text-foreground/70 text-sm">Verifying your reset link...</p>
    )
  }

  if (status === 'invalid') {
    return shell(
      <>
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">
            This reset link is invalid or has expired. Reset links can only be used once.
          </p>
        </div>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => router.push('/auth/login')}
        >
          Back to sign in
        </Button>
      </>
    )
  }

  if (status === 'saved') {
    return shell(
      <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-sm text-green-800 dark:text-green-300">
          Password updated. Taking you to your stash...
        </p>
      </div>
    )
  }

  return shell(
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1"
          >
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Choose a new password"
          />
          <p className="text-xs text-foreground/60 mt-1">At least 6 characters</p>
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Re-enter your new password"
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Update password'}
        </Button>
      </form>
    </>
  )
}
