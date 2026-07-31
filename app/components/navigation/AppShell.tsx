'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { useHydrated, useSidebarCollapsed } from './sidebarState'

/**
 * Two-column app frame: a fixed sidebar rail plus the content well, whose
 * offset tracks the rail's collapsed state. Auth screens opt out of the chrome
 * and render full-bleed.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const collapsed = useSidebarCollapsed()
  const hydrated = useHydrated()

  if (pathname.startsWith('/auth')) return <>{children}</>

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
