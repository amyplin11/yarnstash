'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { Button } from '@/app/components/ui/Button'

const navItems = [
  { name: 'Queue', path: '/queue', icon: '📋' },
  { name: 'Explore', path: '/explore', icon: '🔍' },
  { name: 'Yarns', path: '/yarns', icon: '🧶' },
  { name: 'Stash', path: '/stash', icon: '📦' },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <nav className="bg-background border-b border-foreground/10 sticky top-0 z-50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-2 text-xl font-semibold text-foreground hover:text-teal-600 transition-colors">
            <span>🧶</span>
            <span>YarnStash</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                        : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    {item.name}
                  </Link>
                )
              })}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-2 border-l border-foreground/10 pl-4">
              {user ? (
                <>
                  <span className="text-sm text-foreground/70">
                    {user.email}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="sm" onClick={() => router.push('/auth/login')}>
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-foreground/10">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                        : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                )
              })}

              {/* Mobile User Menu */}
              <div className="border-t border-foreground/10 pt-2 mt-2 px-4 space-y-2">
                {user ? (
                  <>
                    <p className="text-sm text-foreground/70 py-2">
                      {user.email}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full">
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      router.push('/auth/login')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full"
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
