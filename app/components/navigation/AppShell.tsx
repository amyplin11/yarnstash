'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { useSidebarCollapsed } from './sidebarState'
import { useHydrated } from '@/app/components/ui/useHydrated'

/**
 * Two-column app frame: a fixed sidebar rail plus the content well, whose
 * offset tracks the rail's collapsed state. Auth screens and the marketing
 * page opt out of the chrome and render full-bleed.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const collapsed = useSidebarCollapsed()
  const hydrated = useHydrated()

  // `/` is the signed-out marketing page and carries its own header; anyone
  // signed in is redirected off it by middleware before this renders.
  if (pathname === '/' || pathname.startsWith('/auth')) return <>{children}</>

  return (
    <>
      <Sidebar />
      <div
        className={`${collapsed ? 'lg:pl-[88px]' : 'lg:pl-[280px]'} ${
          hydrated ? 'transition-[padding] duration-200 ease-out' : ''
        }`}
      >
        {children}
      </div>
    </>
  )
}
