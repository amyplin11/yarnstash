'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { Project, ProjectRow, projectRowToProject } from '@/lib/types'

interface ProjectsContextType {
  projects: Project[]
  loading: boolean
  error: string | null
  /** Re-fetch from `/api/projects` — call after creating or editing a project. */
  refresh: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined)

/**
 * One shared read of the caller's projects.
 *
 * The dashboard, the queue page and the sidebar badge all want the same list,
 * and the sidebar is mounted on every route — so fetching here rather than in
 * each consumer keeps it to a single request per session instead of one per
 * component per navigation.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // `onAuthStateChange` hands back a fresh User object on every token refresh,
  // so key the effect off the id — depending on `user` itself would refetch on
  // each refresh.
  const userId = user?.id ?? null

  // Guards against a slow response for a previous user landing after a newer
  // request has already been issued.
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++requestId.current

    if (!userId) {
      setProjects([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }

      const data = await response.json()
      if (current !== requestId.current) return

      const rows: ProjectRow[] = data.projects ?? []
      setProjects(rows.map(projectRowToProject))
    } catch (err) {
      console.error('Error fetching projects:', err)
      if (current !== requestId.current) return
      setError('Failed to load your projects. Please try again.')
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // `loading` starts true and nothing has cleared it yet, so waiting out the
    // auth check needs no state change — consumers keep showing a skeleton
    // rather than flashing an empty queue at a signed-in user.
    if (authLoading) return
    refresh()
  }, [authLoading, refresh])

  return (
    <ProjectsContext.Provider value={{ projects, loading, error, refresh }}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectsContext)
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider')
  }
  return context
}
