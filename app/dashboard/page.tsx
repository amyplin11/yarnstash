import Link from 'next/link'
import { ProjectCard } from '@/app/components/projects/ProjectCard'
import { TodayStamp } from '@/app/components/ui/TodayStamp'
import { mockProjects } from '@/lib/data/mockProjects'
import { mockStashYarns } from '@/lib/data/mockYarns'
import {
  ArrowRightIcon,
  ClipboardIcon,
  DropletIcon,
  PackageIcon,
  PaletteIcon,
  PlusIcon,
  RulerIcon,
  SpokesIcon,
} from '@/app/components/ui/icons'

export default function Home() {
  const queuedProjects = mockProjects.filter((p) => p.status === 'queued').length
  const inProgressProjects = mockProjects.filter((p) => p.status === 'in-progress').length
  const totalStashSkeins = mockStashYarns.reduce((sum, yarn) => sum + yarn.skeins, 0)
  const totalYardage = mockStashYarns.reduce(
    (sum, yarn) => sum + yarn.yarn.yardage * yarn.skeins,
    0
  )

  const upNext = mockProjects.find((p) => p.status === 'queued')
  const currentProjects = mockProjects.filter((p) => p.status === 'in-progress')

  const stats = [
    { value: queuedProjects, label: 'Queued projects', icon: ClipboardIcon, tint: 'bg-terracotta-soft text-terracotta' },
    { value: inProgressProjects, label: 'In progress', icon: SpokesIcon, tint: 'bg-parchment-deep text-ink-muted' },
    { value: totalStashSkeins, label: 'Skeins in stash', icon: PackageIcon, tint: 'bg-parchment-deep text-ink-muted' },
    { value: totalYardage.toLocaleString(), label: 'Total yards', icon: RulerIcon, tint: 'bg-sand text-ink-muted' },
  ]

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
      {/* Hero */}
      <section className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-4 text-terracotta">
            <span className="h-px w-10 bg-terracotta" aria-hidden="true" />
            <span className="eyebrow">Welcome back</span>
          </p>

          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
            Curate your collection with{' '}
            <span className="italic text-sage">YarnStash.</span>
          </h1>

          <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
            Organize your knitting projects, explore new patterns, and manage your yarn
            inventory in one beautiful, tactile space.
          </p>
        </div>

        {/* Date + quick add */}
        <div className="flex shrink-0 items-start gap-6 lg:flex-col lg:items-end lg:gap-5 lg:pt-2">
          <TodayStamp />
          <Link
            href="/patterns/upload"
            aria-label="Upload a pattern"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgba(28,26,23,0.05),0_10px_30px_-12px_rgba(28,26,23,0.3)] transition-colors hover:bg-ink hover:text-parchment"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Current projects */}
      {currentProjects.length > 0 && (
        <section className="mt-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 flex items-center gap-4 text-terracotta">
                <span className="h-px w-10 bg-terracotta" aria-hidden="true" />
                <span className="eyebrow">On the needles</span>
              </p>
              <h2 className="font-display text-4xl tracking-tight text-ink">Current Projects</h2>
            </div>
            <Link
              href="/queue"
              className="group inline-flex items-center gap-2 text-sm font-medium text-terracotta"
            >
              View all projects
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {currentProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Stat strip */}
      <section className="mt-12 grid grid-cols-1 overflow-hidden rounded-3xl bg-surface shadow-[0_1px_2px_rgba(28,26,23,0.04),0_20px_50px_-40px_rgba(28,26,23,0.5)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ value, label, icon: Icon, tint }, i) => (
          <div
            key={label}
            className={`flex items-center gap-4 px-7 py-8 ${
              i > 0 ? 'border-line sm:border-l' : ''
            } ${i >= 2 ? 'sm:border-t lg:border-t-0' : ''}`}
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tint}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-4xl leading-none text-ink">{value}</p>
              <p className="eyebrow mt-2 text-ink-soft">{label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Feature cards */}
      <section className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Project queue — the anchor card */}
        <Link
          href="/queue"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-terracotta p-9 text-parchment transition-colors hover:bg-terracotta-deep lg:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-parchment/15">
              <ClipboardIcon className="h-6 w-6" />
            </span>
            {upNext && (
              <span className="eyebrow rounded-full bg-parchment/15 px-3.5 py-1.5">Up next</span>
            )}
          </div>

          <div className="mt-16">
            <h2 className="font-display text-4xl tracking-tight">Project Queue</h2>
            <p className="mt-3 max-w-md text-parchment/75">
              Track your project queue and works in progress, from cast-on to bind-off.
            </p>

            {upNext && (
              <div className="mt-7 flex items-center justify-between gap-4 rounded-2xl bg-parchment/12 px-5 py-4">
                <div className="min-w-0">
                  <p className="eyebrow text-parchment/60">Next up</p>
                  <p className="mt-1 truncate font-medium">{upNext.name}</p>
                </div>
                <ArrowRightIcon className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </div>
        </Link>

        {/* Explore patterns */}
        <Link
          href="/patterns"
          className="group texture-dots relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-9 transition-shadow hover:shadow-[0_20px_50px_-35px_rgba(28,26,23,0.6)]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-parchment-deep text-ink-muted">
            <PaletteIcon className="h-6 w-6" />
          </span>
          <div className="mt-16">
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink">
              Explore Patterns
            </h2>
            <p className="mt-3 text-ink-muted">Upload a PDF and let it unravel itself.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-terracotta">
              Browse library
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        {/* Browse yarns */}
        <Link
          href="/yarns"
          className="group flex items-center justify-between gap-6 rounded-3xl border border-line bg-surface p-8 transition-shadow hover:shadow-[0_20px_50px_-35px_rgba(28,26,23,0.6)]"
        >
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink">Browse Yarns</h2>
            <p className="mt-2 text-ink-muted">Find your next favorite skein.</p>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-deep transition-transform group-hover:scale-105">
            <DropletIcon className="h-6 w-6" />
          </span>
        </Link>

        {/* Yarn stash */}
        <Link
          href="/stash"
          className="group flex items-center justify-between gap-6 rounded-3xl border border-line bg-surface p-8 transition-shadow hover:shadow-[0_20px_50px_-35px_rgba(28,26,23,0.6)] lg:col-span-2"
        >
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink">Yarn Stash</h2>
            <p className="mt-2 text-ink-muted">
              {totalStashSkeins} skeins waiting on a project.
            </p>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sand-soft text-ink-muted transition-transform group-hover:scale-105">
            <PackageIcon className="h-6 w-6" />
          </span>
        </Link>
      </section>
    </main>
  )
}
