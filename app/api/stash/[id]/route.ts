import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { MIN_SKEINS, NUMBER_FIELDS, TEXT_FIELDS } from '@/lib/stash/fields'

// PUT - Update stash yarn
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerClient()

    // This route previously ran the update with no auth check and no user
    // scoping, so it leaned entirely on RLS and answered an opaque 500 when
    // RLS refused. DELETE below already did it properly; PUT now matches.
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Whitelist rather than passing the body straight through: an unknown key
    // fails the update with an opaque 500, and `user_id` or `id` coming from
    // the client has no business reaching the table at all.
    const updates: Record<string, unknown> = {}
    for (const field of TEXT_FIELDS) {
      const value = body?.[field]
      if (typeof value === 'string') updates[field] = value.trim() || null
    }
    for (const field of NUMBER_FIELDS) {
      if (body?.[field] === undefined || body?.[field] === '') continue
      const value = Number(body[field])
      if (Number.isFinite(value)) updates[field] = value
    }
    if (updates.skeins !== undefined) {
      updates.skeins = Math.max(MIN_SKEINS, Math.round(Number(updates.skeins)))
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields in request body' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('stash_yarns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure a user can only update their own yarns
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating stash yarn:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // No row came back: either it does not exist or it belongs to someone
    // else. Same answer either way, so the response can't be used to probe.
    if (!data) {
      return NextResponse.json({ error: 'Yarn not found' }, { status: 404 })
    }

    return NextResponse.json({ yarn: data })
  } catch (error) {
    console.error('Error in PUT /api/stash/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to update stash yarn' },
      { status: 500 }
    )
  }
}

// DELETE - Remove yarn from stash
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('stash_yarns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only delete their own yarns

    if (error) {
      console.error('Error deleting stash yarn:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/stash/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete stash yarn' },
      { status: 500 }
    )
  }
}
