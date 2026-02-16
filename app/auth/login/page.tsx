'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
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
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
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
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Sign In View (Original)
  if (!isSignUp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              🧶 YarnStash
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
                className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true)
                setError(null)
                setMessage(null)
              }}
              className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </Card>
      </div>
    )
  }

  // Sign Up View (New Fun Design!)
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-teal-900/20 dark:to-purple-900/20 p-4 py-12">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Features */}
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-4">
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
                    Know exactly what yarn you have, where it's stored, and how much you spent
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
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                  className="w-full px-4 py-3 rounded-lg border border-foreground/20 bg-background text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="••••••••"
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
                onClick={() => {
                  setIsSignUp(false)
                  setError(null)
                  setMessage(null)
                }}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
              >
                Already have an account? Sign in
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
