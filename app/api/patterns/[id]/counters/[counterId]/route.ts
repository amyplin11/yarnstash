import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const MAX_NAME_LENGTH = 60

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; counterId: string }> }
) {
  try {
    const { id, counterId } = await params
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: { name?: string; value?: number } = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        return NextResponse.json({ error: 'Name must be a string' }, { status: 400 })
      }
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      if (name.length > MAX_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
          { status: 400 }
        )
      }
      updates.name = name
    }

    if (body.value !== undefined) {
      if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
        return NextResponse.json({ error: 'Value must be a number' }, { status: 400 })
      }
      // The minus button stops at zero; clamp here too so a stale client or a
      // direct call can't drive a counter negative past the check constraint.
      updates.value = Math.max(0, Math.floor(body.value))
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: counter, error } = await supabase
      .from('pattern_counters')
      .update(updates)
      .eq('id', counterId)
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !counter) {
      if (error) console.error('Error updating counter:', error)
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    return NextResponse.json({ counter })
  } catch (error) {
    console.error('Error in PATCH /api/patterns/[id]/counters/[counterId]:', error)
    return NextResponse.json({ error: 'Failed to update counter' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; counterId: string }> }
) {
  try {
    const { id, counterId } = await params
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: deleted, error } = await supabase
      .from('pattern_counters')
      .delete()
      .eq('id', counterId)
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .select('id')
      .single()

    if (error || !deleted) {
      if (error) console.error('Error deleting counter:', error)
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/patterns/[id]/counters/[counterId]:', error)
    return NextResponse.json({ error: 'Failed to delete counter' }, { status: 500 })
  }
}
