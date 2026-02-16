import Link from 'next/link'
import { Card } from './components/ui/Card'
import { mockProjects } from '@/lib/data/mockProjects'
import { mockStashYarns } from '@/lib/data/mockYarns'

export default function Home() {
  // Calculate quick stats
  const queuedProjects = mockProjects.filter(p => p.status === 'queued').length
  const inProgressProjects = mockProjects.filter(p => p.status === 'in-progress').length
  const totalStashSkeins = mockStashYarns.reduce((sum, yarn) => sum + yarn.skeins, 0)
  const totalYardage = mockStashYarns.reduce(
    (sum, yarn) => sum + (yarn.yarn.yardage * yarn.skeins),
    0
  )

  const sections = [
    {
      title: 'Project Queue',
      icon: '📋',
      description: 'Track your project queue and works in progress',
      href: '/queue',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Explore Patterns',
      icon: '🔍',
      description: 'Discover new knitting patterns',
      href: '/explore',
      color: 'from-teal-500 to-teal-600',
    },
    {
      title: 'Browse Yarns',
      icon: '🧶',
      description: 'Browse yarn options and find your next favorite',
      href: '/yarns',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Yarn Stash',
      icon: '📦',
      description: 'Manage your personal yarn collection',
      href: '/stash',
      color: 'from-amber-500 to-amber-600',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4">
            Welcome to YarnStash
          </h1>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Organize your knitting projects and yarn collection in one beautiful place
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              {queuedProjects}
            </div>
            <div className="text-sm text-foreground/70 mt-1">Queued Projects</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {inProgressProjects}
            </div>
            <div className="text-sm text-foreground/70 mt-1">In Progress</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {totalStashSkeins}
            </div>
            <div className="text-sm text-foreground/70 mt-1">Skeins in Stash</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalYardage.toLocaleString()}
            </div>
            <div className="text-sm text-foreground/70 mt-1">Total Yards</div>
          </Card>
        </div>

        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="p-8 hover:scale-[1.02] transition-transform cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className={`text-5xl p-4 rounded-2xl bg-gradient-to-br ${section.color} bg-opacity-10`}>
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-foreground mb-2">
                      {section.title}
                    </h3>
                    <p className="text-foreground/70">
                      {section.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Footer Message */}
        <div className="text-center mt-16 text-foreground/60">
          <p>Happy knitting! 🧶✨</p>
        </div>
      </main>
    </div>
  )
}
