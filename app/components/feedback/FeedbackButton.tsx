'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { MessageIcon } from '@/app/components/ui/icons'

export const FEEDBACK_EMAIL = 'team.rootslinks@gmail.com'

/** Shown in the mail subject line so reports are easy to triage. */
const APP_NAME = 'YarnStash'

/**
 * Builds the `mailto:` for the feedback button, prefilling the page and account
 * the reporter was on — most "it's broken" emails don't say where.
 */
function useFeedbackMailto(topic: string) {
  const pathname = usePathname()
  const { user } = useAuth()

  const subject = `${APP_NAME} feedback: ${topic}`
  const body = [
    'What went wrong (or what would you like to see)?',
    '',
    '',
    '---',
    `Page: ${pathname}`,
    `Account: ${user?.email ?? 'not signed in'}`,
  ].join('\n')

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Feedback row for the sidebar, sitting just above the account panel. The
 * sidebar is hidden on the auth screens, which carry their own `FeedbackLink`s
 * instead — a user who can't sign in still has a way to reach us.
 */
export function FeedbackNavItem({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const href = useFeedbackMailto('general')

  return (
    <a
      href={href}
      onClick={onNavigate}
      title={collapsed ? 'Feedback' : undefined}
      aria-label={`Send feedback to ${FEEDBACK_EMAIL}`}
      className={`mb-2 flex items-center rounded-2xl py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-parchment-deep hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
        collapsed ? 'justify-center px-0' : 'gap-3.5 px-4'
      }`}
    >
      <MessageIcon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>Feedback</span>}
    </a>
  )
}

/**
 * Inline text version for placing the same mailto inside a page — used on the
 * auth screens so help is right next to the form that failed.
 */
export function FeedbackLink({
  topic,
  children,
  className = '',
}: {
  topic: string
  children: ReactNode
  className?: string
}) {
  const href = useFeedbackMailto(topic)

  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
