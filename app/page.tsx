import Link from 'next/link'
import {
  ArrowRightIcon,
  ClipboardIcon,
  CloudUploadIcon,
  PackageIcon,
  YarnMark,
} from './components/ui/icons'

export const metadata = {
  title: 'YarnStash — Your knitting, all in one place',
  description:
    'Keep your patterns, yarn stash, and project queue in one warm, tactile workspace. Free to start.',
}

/**
 * Marketing home. Deliberately a server component with no user records and no
 * Supabase call: middleware lets signed-out visitors reach `/`, so anything
 * user-scoped here would either leak or crash. Signed-in visitors never see it
 * — middleware sends them to /dashboard before this renders.
 */

const features = [
  {
    icon: CloudUploadIcon,
    title: 'Patterns that read themselves',
    body: 'Upload a PDF and YarnStash pulls out the needles, gauge, and yardage so you are not squinting at page four to remember what weight you needed.',
  },
  {
    icon: PackageIcon,
    title: 'A stash you can actually see',
    body: 'Every skein, colorway, and dye lot in one place — with the yardage math already done, so you know whether you have enough before you cast on.',
  },
  {
    icon: ClipboardIcon,
    title: 'From queue to bind-off',
    body: 'Line up what is next, track what is on the needles, and keep the finished ones where you can admire them.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        <span className="flex items-center gap-3.5">
          <YarnMark className="h-11 w-11" />
          <span className="font-display text-2xl tracking-tight text-ink">YarnStash</span>
        </span>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/login"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-parchment-deep"
          >
            Log in
          </Link>
          <Link
            href="/auth/login?mode=signup"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors hover:bg-terracotta"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 sm:px-10 lg:px-14">
        {/* Hero */}
        <section className="pt-12 pb-16 sm:pt-20 lg:pt-24">
          <p className="mb-5 flex items-center gap-4 text-terracotta">
            <span className="h-px w-10 bg-terracotta" aria-hidden="true" />
            <span className="eyebrow">For people with more yarn than time</span>
          </p>

          <h1 className="max-w-3xl font-display text-5xl leading-[1.03] tracking-[-0.02em] text-ink sm:text-6xl lg:text-7xl">
            Your knitting, <span className="italic text-sage">all in one place.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            Patterns, yarn, and works in progress — organized in a space that feels
            like your studio instead of a spreadsheet.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/auth/login?mode=signup"
              className="group inline-flex items-center gap-2.5 rounded-full bg-terracotta px-7 py-3.5 font-medium text-parchment transition-colors hover:bg-terracotta-deep"
            >
              Start your stash
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-7 py-3.5 font-medium text-ink transition-colors hover:bg-parchment-deep"
            >
              I already have an account
            </Link>
          </div>

          <p className="mt-5 text-sm text-ink-soft">Free to start. No card, no fuss.</p>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="texture-dots rounded-3xl border border-line bg-surface p-9"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-parchment-deep text-ink-muted">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-14 font-display text-3xl leading-[1.1] tracking-tight text-ink">
                {title}
              </h2>
              <p className="mt-3 leading-relaxed text-ink-muted">{body}</p>
            </div>
          ))}
        </section>

        {/* Closing CTA */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-terracotta px-9 py-14 text-parchment sm:px-14 sm:py-16">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              Cast on with a clear head.
            </h2>
            <p className="mt-4 leading-relaxed text-parchment/75">
              Get your patterns and stash in order, then spend your evenings knitting
              instead of hunting for that one half-used skein.
            </p>
            <Link
              href="/auth/login?mode=signup"
              className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-parchment px-7 py-3.5 font-medium text-ink transition-colors hover:bg-parchment-deep"
            >
              Create your account
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 sm:px-10 lg:px-14">
          <span className="flex items-center gap-2.5">
            <YarnMark className="h-7 w-7" />
            <span className="font-display text-lg tracking-tight text-ink">YarnStash</span>
          </span>
          <p className="text-sm text-ink-soft">Made for knitters, by knitters.</p>
        </div>
      </footer>
    </div>
  )
}
