import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { MAX_NOTE_LENGTH, isNoteType, isProjectDetailType } from '@/lib/patterns/notes'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: notes, error } = await supabase
      .from('pattern_notes')
      .select('*')
      .eq('pattern_id', id)
      .eq('user_id', userId)
      .order('created_at')

    if (error) {
      console.error('Error fetching notes:', error)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({ notes: notes || [] })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

/**
 * Add a note. A project detail (size, yarn, ...) is one row per field, so
 * posting a detail that already exists overwrites it instead of adding a
 * second row — a double-submitted form cannot leave two "Size knit" values.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const noteText = typeof body.note_text === 'string' ? body.note_text.trim() : ''
    if (!noteText) {
      return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 })
    }
    if (noteText.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` },
        { status: 400 }
      )
    }

    const noteType = body.note_type ?? 'general'
    if (!isNoteType(noteType)) {
      return NextResponse.json({ error: 'Unknown note type' }, { status: 400 })
    }

    const instructionId: string | null =
      typeof body.instruction_id === 'string' && body.instruction_id ? body.instruction_id : null
    if (instructionId && isProjectDetailType(noteType)) {
      return NextResponse.json(
        { error: 'Project details cannot be tied to a step' },
        { status: 400 }
      )
    }

    // Only notes on a pattern the caller owns. RLS on pattern_notes keys off
    // user_id alone, so without this a valid user could hang a note off
    // someone else's pattern id.
    const { data: pattern } = await supabase
      .from('patterns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    // And a step note's instruction must belong to this pattern, or the note
    // would show up under a step that is not on the page.
    if (instructionId) {
      const { data: instruction } = await supabase
        .from('pattern_instructions')
        .select('section_id')
        .eq('id', instructionId)
        .single()

      const { data: section } = instruction
        ? await supabase
            .from('pattern_sections')
            .select('id')
            .eq('id', instruction.section_id)
            .eq('pattern_id', id)
            .single()
        : { data: null }

      if (!section) {
        return NextResponse.json({ error: 'Step not found' }, { status: 404 })
      }
    }

    if (isProjectDetailType(noteType)) {
      const { data: existing, error: existingError } = await supabase
        .from('pattern_notes')
        .select('id')
        .eq('pattern_id', id)
        .eq('user_id', userId)
        .eq('note_type', noteType)
        .is('instruction_id', null)
        .limit(1)

      if (existingError) {
        console.error('Error reading project detail before insert:', existingError)
        return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
      }

      if (existing && existing.length > 0) {
        const { data: note, error } = await supabase
          .from('pattern_notes')
          .update({ note_text: noteText, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id)
          .eq('user_id', userId)
          .select()
          .single()

        if (error) {
          console.error('Error updating project detail:', error)
          return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
        }
        return NextResponse.json({ note })
      }
    }

    const { data: note, error } = await supabase
      .from('pattern_notes')
      .insert({
        user_id: userId,
        pattern_id: id,
        instruction_id: instructionId,
        note_text: noteText,
        note_type: noteType,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating note:', error)
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/patterns/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
}
