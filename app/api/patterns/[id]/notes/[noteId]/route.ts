import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { MAX_NOTE_LENGTH } from '@/lib/patterns/notes'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id, noteId } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: { note_text?: string; is_pinned?: boolean; updated_at?: string } = {}

    if (body.note_text !== undefined) {
      if (typeof body.note_text !== 'string') {
        return NextResponse.json({ error: 'Note must be a string' }, { status: 400 })
      }
      const noteText = body.note_text.trim()
      // Clearing a note is a delete, not an empty row.
      if (!noteText) {
        return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 })
      }
      if (noteText.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` },
          { status: 400 }
        )
      }
      updates.note_text = noteText
    }

    if (body.is_pinned !== undefined) {
      if (typeof body.is_pinned !== 'boolean') {
        return NextResponse.json({ error: 'is_pinned must be a boolean' }, { status: 400 })
      }
      updates.is_pinned = body.is_pinned
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // No trigger is known to maintain updated_at on this table (it predates
    // migration tracking), so set it here.
    updates.updated_at = new Date().toISOString()

    const { data: note, error } = await supabase
      .from('pattern_notes')
      .update(updates)
      .eq('id', noteId)
      .eq('pattern_id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !note) {
      if (error) console.error('Error updating note:', error)
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Error in PATCH /api/patterns/[id]/notes/[noteId]:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id, noteId } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: deleted, error } = await supabase
      .from('pattern_notes')
      .delete()
      .eq('id', noteId)
      .eq('pattern_id', id)
      .eq('user_id', userId)
      .select('id')
      .single()

    if (error || !deleted) {
      if (error) console.error('Error deleting note:', error)
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/patterns/[id]/notes/[noteId]:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
