'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

/**
 * Two-column app frame: a fixed sidebar rail plus the content well. Auth
 * screens opt out of the chrome and render full-bleed.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname.startsWith('/auth')

  return (
    <>
      <Sidebar />
      <div className={bare ? undefined : 'lg:pl-[280px]'}>{children}</div>
    </>
  )
}
