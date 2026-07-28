'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

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
 * Floating feedback button, rendered from the root layout so it is reachable on
 * every page — including the sign-in screen, where a user who can't get in has
 * no other way to reach us.
 */
export function FeedbackButton() {
  const href = useFeedbackMailto('general')

  return (
    <a
      href={href}
      aria-label={`Send feedback to ${FEEDBACK_EMAIL}`}
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:bg-teal-700 dark:hover:bg-teal-600"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <span>Feedback</span>
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
