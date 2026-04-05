import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: wip } = await supabase
      .from('user_pattern_progress')
      .select('*')
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ wip: wip || null })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/wip:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if progress record already exists
    const { data: existing } = await supabase
      .from('user_pattern_progress')
      .select('id')
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .single()

    const progressData = {
      current_section_id: body.current_section_id,
      current_instruction_id: body.current_instruction_id,
      completed_instructions: body.completed_instructions,
      row_counter: body.row_counter,
      selected_size: body.selected_size,
      last_worked_at: new Date().toISOString(),
    }

    if (existing) {
      const { data: wip, error } = await supabase
        .from('user_pattern_progress')
        .update(progressData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating wip:', error)
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
      }

      return NextResponse.json({ wip })
    } else {
      const { data: wip, error } = await supabase
        .from('user_pattern_progress')
        .insert({
          user_id: user.id,
          pattern_id: id,
          ...progressData,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating wip:', error)
        return NextResponse.json({ error: 'Failed to create progress' }, { status: 500 })
      }

      return NextResponse.json({ wip })
    }
  } catch (error) {
    console.error('Error in PUT /api/patterns/[id]/wip:', error)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
