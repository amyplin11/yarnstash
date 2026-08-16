import { NextResponse, type NextRequest } from 'next/server'

// The only pages a signed-out visitor may see. Everything else redirects to
// `/`, the marketing page, which is where they log in or sign up from. `/` is a
// server component with no user records, and reset-password has to stay
// reachable or a locked-out user could never get back in.
const PUBLIC_PATHS = new Set(['/', '/auth/login', '/auth/reset-password'])

// Where a signed-out visitor is sent, and where a signed-in one is sent if they
// land on the marketing page.
const MARKETING_PATH = '/'
const APP_HOME = '/dashboard'

// supabase-js derives its storage key from the project ref, and the cookie
// adapters in lib/supabase/{client,server}.ts read and write it under that
// name. Derive it here rather than hardcoding a ref so a checkout pointed at
// a different Supabase project still guards correctly.
function authCookieName(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    const ref = new URL(url).hostname.split('.')[0]
    return ref ? `sb-${ref}-auth-token` : null
  } catch {
    return null
  }
}

// Cheap local session check so a stale cookie doesn't buy a look at a
// protected page. Deliberately no network call — middleware runs on every
// navigation, and a round trip to Supabase per request is not worth it for a
// routing decision.
//
// Fails closed: a cookie that is present but unreadable counts as signed out.
// Otherwise `document.cookie = 'sb-<ref>-auth-token=junk'` in devtools would
// be enough to walk past the gate, and /yarns and /queue have no client-side
// guard behind it to catch that. The cost of this choice is that a future
// change to how supabase-js encodes the session would lock users out until
// this parser is updated — a loud failure, which is the right way round.
function sessionUsable(raw: string): boolean {
  try {
    const json = raw.startsWith('base64-')
      ? atob(raw.slice('base64-'.length))
      : decodeURIComponent(raw)
    const expiresAt = JSON.parse(json)?.expires_at
    // A real session object that simply records no expiry still counts.
    if (typeof expiresAt !== 'number') return true
    return expiresAt * 1000 > Date.now()
  } catch {
    return false
  }
}

// Routing gate, not the security boundary. It stops a signed-out visitor from
// loading protected pages at all, which client-side `useAuth()` redirects
// cannot do (they render first, then bounce). Actual enforcement still lives
// where it always did: RLS on every user-scoped table, plus the per-route
// `createServerClient()` + `getUser()` checks.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes authenticate themselves and answer 401 in JSON. Redirecting
  // them to an HTML login page would break that contract.
  if (pathname.startsWith('/api/')) return NextResponse.next()

  const cookieName = authCookieName()
  const raw = cookieName ? request.cookies.get(cookieName)?.value : undefined
  // No cookie name means the Supabase env is missing, so nothing can be signed
  // in anyway — fail closed rather than expose every page.
  const signedIn = Boolean(raw && sessionUsable(raw))

  // The marketing page is for visitors. Someone already signed in who lands on
  // `/` — a bookmark, or the browser's default — wants the app, not the pitch.
  if (pathname === MARKETING_PATH) {
    if (!signedIn) return NextResponse.next()
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = APP_HOME
    appUrl.search = ''
    return NextResponse.redirect(appUrl)
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  if (signedIn) return NextResponse.next()

  // Signed-out visitors land on the marketing page rather than a bare login
  // form, so the first thing they see explains what this is.
  const marketingUrl = request.nextUrl.clone()
  marketingUrl.pathname = MARKETING_PATH
  marketingUrl.search = ''
  return NextResponse.redirect(marketingUrl)
}

export const config = {
  // Everything except Next internals and static files. Without the asset
  // exclusions the redirect would swallow CSS and images on the login page
  // itself.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
