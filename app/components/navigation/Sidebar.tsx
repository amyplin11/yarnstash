'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { mockProjects } from '@/lib/data/mockProjects'
import {
  CloseIcon,
  DropletIcon,
  FileIcon,
  GridIcon,
  InboxIcon,
  ListIcon,
  LogOutIcon,
  MenuIcon,
  YarnMark,
} from '@/app/components/ui/icons'

const navItems = [
  { name: 'Studio', path: '/', icon: GridIcon, exact: true },
  { name: 'Queue', path: '/queue', icon: ListIcon },
  { name: 'Patterns', path: '/patterns', icon: FileIcon },
  { name: 'Yarns', path: '/yarns', icon: DropletIcon },
  { name: 'Stash', path: '/stash', icon: InboxIcon },
]

function isActivePath(pathname: string, path: string, exact?: boolean) {
  return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const queuedCount = mockProjects.filter((p) => p.status === 'queued').length

  return (
    <nav className="flex flex-col gap-1">
      <p className="eyebrow mb-3 px-4 text-ink-soft">Menu</p>
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.path, item.exact)
        const Icon = item.icon
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[0.95rem] transition-colors ${
              active
                ? 'bg-surface text-terracotta font-semibold shadow-[0_1px_2px_rgba(28,26,23,0.04),0_8px_24px_-12px_rgba(28,26,23,0.18)]'
                : 'text-ink-muted hover:bg-parchment-deep hover:text-ink'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{item.name}</span>
            {item.name === 'Queue' && queuedCount > 0 && (
              <span className="rounded-full bg-parchment-deep px-2 py-0.5 text-xs font-semibold text-ink-muted">
                {queuedCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function AccountPanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    onNavigate?.()
    await signOut()
    router.push('/')
  }

  if (!user) {
    return (
      <div className="border-t border-line pt-5">
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-parchment transition-colors hover:bg-terracotta"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="border-t border-line pt-5">
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-soft font-display text-lg text-sage-deep">
          {user.email?.[0]?.toUpperCase() ?? 'K'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{user.email}</p>
          <p className="text-xs text-ink-soft">Pro Member</p>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line-strong px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-parchment-deep"
      >
        <LogOutIcon className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  )
}

function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3.5">
      <YarnMark className="h-11 w-11" />
      <span className="font-display text-2xl tracking-tight text-ink">YarnStash</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // The auth screens are standalone — no shell chrome around them.
  if (pathname.startsWith('/auth')) return null

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col justify-between border-r border-line bg-parchment px-6 py-8 lg:flex">
        <div>
          <div className="mb-12 px-1">
            <Wordmark />
          </div>
          <NavList />
        </div>
        <AccountPanel />
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-parchment/90 px-5 py-3.5 backdrop-blur lg:hidden">
        <Wordmark />
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/25"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-line bg-parchment px-6 py-8">
            <div>
              <div className="mb-10 flex items-center justify-between">
                <Wordmark onNavigate={() => setDrawerOpen(false)} />
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <AccountPanel onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
