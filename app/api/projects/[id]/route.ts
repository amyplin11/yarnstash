import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { columnsFromBody, PROJECT_SELECT, yarnRowsFromBody } from '@/lib/projects/columns'
import type { ProjectRow } from '@/lib/types'

// GET - a single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project: data as ProjectRow })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// PATCH - update a project; a `yarns` array replaces the project's yarn list
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const columns = columnsFromBody(body)
    const replacingYarns = Array.isArray(body?.yarns)

    if (Object.keys(columns).length === 0 && !replacingYarns) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    // Scoped by user_id as well as id: RLS already enforces this, but it also
    // turns someone else's id into a clean 404 instead of a silent no-op.
    if (Object.keys(columns).length > 0) {
      // `updated_at` is maintained by the update_projects_updated_at trigger.
      const { data, error } = await supabase
        .from('projects')
        .update(columns)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle()

      if (error) {
        console.error('Error updating project:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    } else {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error loading project:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    if (replacingYarns) {
      // Replacing the list means delete-then-insert, which is two statements
      // with no transaction around them. Keep the old rows so a failed insert
      // can put them back rather than leaving the project with no yarn.
      const { data: previous } = await supabase
        .from('project_yarns')
        .select('*')
        .eq('project_id', id)

      const { error: deleteError } = await supabase
        .from('project_yarns')
        .delete()
        .eq('project_id', id)

      if (deleteError) {
        console.error('Error clearing project yarns:', deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      const yarnRows = yarnRowsFromBody(body, id)
      if (yarnRows.length > 0) {
        const { error: insertError } = await supabase.from('project_yarns').insert(yarnRows)

        if (insertError) {
          console.error('Error replacing project yarns, restoring previous:', insertError)
          if (previous?.length) await supabase.from('project_yarns').insert(previous)
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }
    }

    const { data: updated, error: reloadError } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (reloadError) {
      console.error('Error reloading project:', reloadError)
      return NextResponse.json({ error: reloadError.message }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project: updated as ProjectRow })
  } catch (error) {
    console.error('Error in PATCH /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// DELETE - remove a project; project_yarns rows cascade with it
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Error deleting project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
