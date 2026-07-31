'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { mockProjects } from '@/lib/data/mockProjects'
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CloseIcon,
  DropletIcon,
  FileIcon,
  GridIcon,
  InboxIcon,
  ListIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  YarnMark,
} from '@/app/components/ui/icons'
import { toggleSidebar, useSidebarCollapsed } from './sidebarState'
import { useHydrated } from '@/app/components/ui/useHydrated'

// The user's own things first, then the browse-everything destinations.
const navItems = [
  { name: 'Home', path: '/', icon: GridIcon, exact: true },
  { name: 'My Patterns', path: '/patterns', icon: FileIcon },
  { name: 'My Yarn Stash', path: '/stash', icon: InboxIcon },
  { name: 'Queue', path: '/queue', icon: ListIcon },
  { name: 'Yarns', path: '/yarns', icon: DropletIcon },
]

function isActivePath(pathname: string, path: string, exact?: boolean) {
  return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
}

function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const queuedCount = mockProjects.filter((p) => p.status === 'queued').length

  return (
    <nav className="flex flex-col gap-1">
      {!collapsed && <p className="eyebrow mb-3 px-4 text-ink-soft">Menu</p>}
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.path, item.exact)
        const Icon = item.icon
        // Keyed off the route, not the label, so renaming an item can't drop the count.
        const badge = item.path === '/queue' && queuedCount > 0 ? queuedCount : null

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            title={collapsed ? item.name : undefined}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center rounded-2xl py-3.5 text-[0.95rem] transition-colors ${
              collapsed ? 'justify-center px-0' : 'gap-3.5 px-4'
            } ${
              active
                ? 'bg-surface text-terracotta font-semibold shadow-[0_1px_2px_rgba(28,26,23,0.04),0_8px_24px_-12px_rgba(28,26,23,0.18)]'
                : 'text-ink-muted hover:bg-parchment-deep hover:text-ink'
            }`}
          >
            <span className="relative shrink-0">
              <Icon className="h-5 w-5" />
              {collapsed && badge && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[0.625rem] font-semibold text-parchment">
                  {badge}
                </span>
              )}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1">{item.name}</span>
                {badge && (
                  <span className="rounded-full bg-parchment-deep px-2 py-0.5 text-xs font-semibold text-ink-muted">
                    {badge}
                  </span>
                )}
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function AccountPanel({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
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
          title={collapsed ? 'Sign in' : undefined}
          className={`flex w-full items-center justify-center gap-2 bg-ink text-sm font-medium text-parchment transition-colors hover:bg-terracotta ${
            collapsed ? 'aspect-square rounded-2xl' : 'rounded-2xl px-4 py-3'
          }`}
        >
          {collapsed ? <LogInIcon className="h-5 w-5" /> : 'Sign In'}
        </Link>
      </div>
    )
  }

  return (
    <div className="border-t border-line pt-5">
      <div className={`mb-4 flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-1'}`}>
        <span
          title={collapsed ? (user.email ?? undefined) : undefined}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-soft font-display text-lg text-sage-deep"
        >
          {user.email?.[0]?.toUpperCase() ?? 'K'}
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user.email}</p>
            <p className="text-xs text-ink-soft">Pro Member</p>
          </div>
        )}
      </div>
      <button
        onClick={handleSignOut}
        title={collapsed ? 'Sign out' : undefined}
        className={`flex w-full items-center justify-center gap-2 border border-line-strong text-sm font-medium text-ink transition-colors hover:bg-parchment-deep ${
          collapsed ? 'aspect-square rounded-2xl' : 'rounded-2xl px-4 py-3'
        }`}
      >
        <LogOutIcon className="h-4 w-4" />
        {!collapsed && 'Sign Out'}
      </button>
    </div>
  )
}

function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <button
      onClick={toggleSidebar}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-parchment-deep hover:text-ink"
    >
      {collapsed ? <ChevronsRightIcon className="h-5 w-5" /> : <ChevronsLeftIcon className="h-5 w-5" />}
    </button>
  )
}

function Wordmark({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3.5" title={collapsed ? 'YarnStash' : undefined}>
      <YarnMark className="h-11 w-11" />
      {!collapsed && <span className="font-display text-2xl tracking-tight text-ink">YarnStash</span>}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const collapsed = useSidebarCollapsed()
  const hydrated = useHydrated()

  // The auth screens are standalone — no shell chrome around them.
  if (pathname.startsWith('/auth')) return null

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col justify-between overflow-x-hidden border-r border-line bg-parchment py-8 lg:flex ${
          collapsed ? 'w-[88px] px-4' : 'w-[280px] px-6'
        } ${hydrated ? 'transition-[width,padding] duration-200 ease-out' : ''}`}
      >
        <div>
          <div className={`mb-12 flex items-center ${collapsed ? 'flex-col gap-4' : 'justify-between px-1'}`}>
            <Wordmark collapsed={collapsed} />
            <CollapseToggle collapsed={collapsed} />
          </div>
          <NavList collapsed={collapsed} />
        </div>
        <AccountPanel collapsed={collapsed} />
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

      {/* Mobile drawer — always full width; the collapse toggle is a desktop affordance. */}
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
