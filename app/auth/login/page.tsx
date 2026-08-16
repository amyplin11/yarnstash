'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { FeedbackLink } from '@/app/components/feedback/FeedbackButton'

type Mode = 'signin' | 'signup' | 'forgot'

const feedbackLinkStyles = 'text-terracotta dark:text-terracotta hover:underline'

function LoginPageInner() {
  // The marketing page has separate "Log in" and "Sign up" calls to action, so
  // `?mode=signup` opens the right form instead of dropping everyone on signin.
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const { user, signIn, signUp } = useAuth()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/stash')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        // Deliberately not confirming whether the address exists — that would
        // let anyone probe for registered users. Errors are swallowed for the
        // same reason: Supabase only reaches the send path for addresses that
        // resolve to a real account, so surfacing the failure would turn this
        // form into the enumeration oracle the neutral copy exists to prevent.
        // (It also produced a baffling 'Email address "..." is invalid' for the
        // sole reason that the account was real.) The console keeps the detail
        // for whoever is debugging delivery.
        if (error) {
          console.error('Password reset request failed:', error)
        }
        setMessage(
          "If an account exists for that email, we've sent a link to reset your password."
        )
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else if (data?.session) {
          // Email confirmation is off, so the account is already usable and
          // Supabase has signed us in — telling them to check their inbox for a
          // mail that will never arrive just strands them on this page.
          router.push('/stash')
        } else {
          setMessage('Account created! Check your email to confirm your account.')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          router.push('/stash')
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  // Forgot Password View
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-tight text-ink mb-2">YarnStash</h1>
            <p className="text-foreground/70">Reset your password</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-terracotta"
                placeholder="you@example.com"
              />
              <p className="text-xs text-foreground/60 mt-1">
                We&apos;ll email you a link to choose a new password.
              </p>
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-sm text-terracotta dark:text-terracotta hover:underline"
            >
              Back to sign in
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-foreground/60">
            Reset link not arriving?{' '}
            <FeedbackLink topic="password reset" className={feedbackLinkStyles}>
              Send feedback
            </FeedbackLink>
          </p>
        </Card>
      </div>
    )
  }

  // Sign In View (Original)
  if (mode === 'signin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-tight text-ink mb-2">
              YarnStash
            </h1>
            <p className="text-foreground/70">Welcome back!</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-terracotta"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-terracotta dark:text-terracotta hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-terracotta"
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-sm text-terracotta dark:text-terracotta hover:underline"
            >
              Don&apos;t have an account? Sign up
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-foreground/60">
            Trouble signing in?{' '}
            <FeedbackLink topic="sign-in problem" className={feedbackLinkStyles}>
              Send feedback
            </FeedbackLink>
          </p>
        </Card>
      </div>
    )
  }

  // Sign Up View (New Fun Design!)
  return (
    <div className="min-h-screen bg-parchment p-4 py-12">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Features */}
          <div className="space-y-8">
            <div>
              <h1 className="font-display text-5xl leading-tight tracking-tight text-ink mb-4">
                Join YarnStash! 🎉
              </h1>
              <p className="text-xl text-foreground/80">
                The ultimate tool for knitters to organize projects and track yarn
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="text-4xl">🧶</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Track Your Stash
                  </h3>
                  <p className="text-foreground/70">
                    Know exactly what yarn you have, where it&apos;s stored, and how much you spent
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="text-4xl">🔍</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Discover Patterns
                  </h3>
                  <p className="text-foreground/70">
                    Browse thousands of knitting patterns from Ravelry and add them to your queue
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="text-4xl">📋</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Manage Projects
                  </h3>
                  <p className="text-foreground/70">
                    Keep track of your project queue, works in progress, and completed projects
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="text-4xl">📊</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Get Insights
                  </h3>
                  <p className="text-foreground/70">
                    See your total yardage, spending, and stash value at a glance
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <Card className="p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Create Your Account
              </h2>
              <p className="text-foreground/70">Start organizing your knitting life!</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {message && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">{message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                  Password
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
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="Choose a password"
                />
                <p className="text-xs text-foreground/60 mt-1">At least 6 characters</p>
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up - It\'s Free! 🎉'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-sm text-terracotta dark:text-terracotta hover:underline"
              >
                Already have an account? Sign in
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-foreground/60">
              Trouble creating an account?{' '}
              <FeedbackLink topic="sign-up problem" className={feedbackLinkStyles}>
                Send feedback
              </FeedbackLink>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// useSearchParams() opts the subtree into client-side rendering, which Next
// requires a Suspense boundary for. Without it the build fails on this route.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
