import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { columnsFromBody, PROJECT_SELECT, yarnRowsFromBody } from '@/lib/projects/columns'
import type { ProjectRow } from '@/lib/types'

// GET - list the caller's projects, newest first
export async function GET() {
  try {
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects: (data as ProjectRow[]) || [] })
  } catch (error) {
    console.error('Error in GET /api/projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST - create a project, with its yarns
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Both are NOT NULL in the table; reject early with a readable message.
    if (!body?.name?.trim() || !body?.pattern?.trim()) {
      return NextResponse.json(
        { error: 'Project name and pattern are required' },
        { status: 400 }
      )
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ ...columnsFromBody(body), user_id: userId })
      .select()
      .single()

    if (error || !project) {
      console.error('Error creating project:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create project' },
        { status: 500 }
      )
    }

    const yarnRows = yarnRowsFromBody(body, project.id)
    if (yarnRows.length > 0) {
      const { error: yarnError } = await supabase.from('project_yarns').insert(yarnRows)

      if (yarnError) {
        // The two inserts do not share a transaction, so undo the project
        // rather than leaving a half-created one behind.
        console.error('Error adding project yarns, rolling back project:', yarnError)
        await supabase.from('projects').delete().eq('id', project.id).eq('user_id', userId)
        return NextResponse.json({ error: yarnError.message }, { status: 500 })
      }
    }

    const { data: created, error: reloadError } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', project.id)
      .single()

    if (reloadError) {
      console.error('Error reloading created project:', reloadError)
      return NextResponse.json({ error: reloadError.message }, { status: 500 })
    }

    return NextResponse.json({ project: created as ProjectRow }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/projects:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
