import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/auth/require-user'
import { findLinkedCopies } from '@/lib/patterns/linked-copies'
import {
  ANCHOR_LABELS,
  MAX_NOTE_LENGTH,
  MAX_SIZE_LENGTH,
  PATTERN_PART_KEY,
  PATTERN_PART_LABEL,
  isNoteAnchor,
  materialKey,
  materialLabel,
  sectionKeys,
  stepKey,
  stepLabel,
  type NoteTarget,
} from '@/lib/patterns/note-parts'
import { parseUsed, usedKindFor } from '@/lib/patterns/note-used'

const NOTE_COLUMNS =
  'id, user_id, pattern_id, size, instruction_id, section_id, material_id, anchor, part_key, part_label, note_text, used, created_at, updated_at'

/**
 * GET — every note on this pattern (all sizes), plus every note on its linked
 * copies: other uploads of the same PDF, usually extracted for another size.
 * The page decides which belong to the size being knit.
 */
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

    const linkedCopies = await findLinkedCopies(supabase, userId, id)
    const patternIds = [id, ...linkedCopies.map((p) => p.id)]

    const { data: notes, error } = await supabase
      .from('pattern_notes')
      .select(NOTE_COLUMNS)
      .eq('user_id', userId)
      .in('pattern_id', patternIds)
      .order('created_at')

    if (error) {
      console.error('Error fetching pattern notes:', error)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({ notes: notes || [], linkedCopies })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

type Resolved = {
  columns: {
    instruction_id: string | null
    section_id: string | null
    material_id: string | null
    anchor: string | null
  }
  partKey: string
  partLabel: string
}

const NO_TARGET = { instruction_id: null, section_id: null, material_id: null, anchor: null }

/**
 * Checks the target belongs to this pattern and works out its part key. The
 * key is computed here rather than trusted from the client, so every copy of a
 * pattern keys its parts the same way.
 */
async function resolveTarget(
  supabase: SupabaseClient,
  patternId: string,
  target: NoteTarget
): Promise<Resolved | null> {
  switch (target.kind) {
    case 'pattern':
      return { columns: NO_TARGET, partKey: PATTERN_PART_KEY, partLabel: PATTERN_PART_LABEL }

    case 'anchor':
      if (!isNoteAnchor(target.anchor)) return null
      return {
        columns: { ...NO_TARGET, anchor: target.anchor },
        partKey: target.anchor,
        partLabel: ANCHOR_LABELS[target.anchor],
      }

    case 'material': {
      const { data } = await supabase
        .from('pattern_materials')
        .select('id, yarn_brand, yarn_name, color_name')
        .eq('id', target.id)
        .eq('pattern_id', patternId)
        .maybeSingle()
      if (!data) return null
      return {
        columns: { ...NO_TARGET, material_id: data.id },
        partKey: materialKey(data),
        partLabel: materialLabel(data),
      }
    }

    case 'section':
    case 'instruction': {
      let sectionId = target.id
      let stepNumber: number | null = null
      if (target.kind === 'instruction') {
        const { data } = await supabase
          .from('pattern_instructions')
          .select('id, section_id, step_number')
          .eq('id', target.id)
          .maybeSingle()
        if (!data) return null
        sectionId = data.section_id
        stepNumber = data.step_number
      }

      // All of the pattern's sections, because a section's key depends on how
      // many earlier sections share its name.
      const { data: sections } = await supabase
        .from('pattern_sections')
        .select('id, section_name, section_order')
        .eq('pattern_id', patternId)
      const sk = sections ? sectionKeys(sections).get(sectionId) : undefined
      if (!sk) return null

      if (stepNumber === null) {
        return { columns: { ...NO_TARGET, section_id: sectionId }, partKey: sk.key, partLabel: sk.label }
      }
      return {
        columns: { ...NO_TARGET, instruction_id: target.id },
        partKey: stepKey(sk.key, stepNumber),
        partLabel: stepLabel(sk.label, stepNumber),
      }
    }

    default:
      return null
  }
}

function parseTarget(raw: unknown): NoteTarget | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  switch (t.kind) {
    case 'pattern':
      return { kind: 'pattern' }
    case 'anchor':
      return isNoteAnchor(t.anchor) ? { kind: 'anchor', anchor: t.anchor } : null
    case 'section':
    case 'material':
    case 'instruction':
      return typeof t.id === 'string' && t.id ? { kind: t.kind, id: t.id } : null
    default:
      return null
  }
}

/**
 * PUT — set the note on one part for one size: `{ target, size, text, used? }`.
 * `used` is the "what I used" form, accepted on gauge, needles and yarn only.
 * There is one note per part per size, so this creates or replaces it; empty
 * text with nothing in `used` deletes it. Returns `{ note }`, or `{ note: null }` after a delete.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, userId } = await getRequestUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const target = parseTarget(body?.target)
    if (!target) {
      return NextResponse.json({ error: 'Invalid note target' }, { status: 400 })
    }

    const size =
      typeof body?.size === 'string' && body.size.trim() ? body.size.trim() : null
    if (size && size.length > MAX_SIZE_LENGTH) {
      return NextResponse.json({ error: 'Invalid size' }, { status: 400 })
    }

    if (typeof body?.text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    const text = body.text.trim()
    if (text.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer` },
        { status: 400 }
      )
    }

    // Only notes on a pattern the caller owns. RLS on pattern_notes keys off
    // user_id alone, so without this a note could hang off someone else's
    // pattern id.
    const { data: pattern } = await supabase
      .from('patterns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    const usedKind = usedKindFor(target)
    if (body?.used != null && !usedKind) {
      return NextResponse.json({ error: 'This part has no "what I used" form' }, { status: 400 })
    }
    const used = usedKind ? parseUsed(body?.used, usedKind) : null

    const resolved = await resolveTarget(supabase, id, target)
    if (!resolved) {
      return NextResponse.json({ error: 'That part of the pattern was not found' }, { status: 404 })
    }

    if (!text && !used) {
      let del = supabase
        .from('pattern_notes')
        .delete()
        .eq('user_id', userId)
        .eq('pattern_id', id)
        .eq('part_key', resolved.partKey)
      del = size === null ? del.is('size', null) : del.eq('size', size)
      const { error } = await del
      if (error) {
        console.error('Error deleting pattern note:', error)
        return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
      }
      return NextResponse.json({ note: null })
    }

    const { data: note, error } = await supabase
      .from('pattern_notes')
      .upsert(
        {
          user_id: userId,
          pattern_id: id,
          size,
          ...resolved.columns,
          part_key: resolved.partKey,
          part_label: resolved.partLabel,
          note_text: text,
          used,
        },
        { onConflict: 'user_id,pattern_id,size,part_key' }
      )
      .select(NOTE_COLUMNS)
      .single()

    if (error) {
      console.error('Error saving pattern note:', error)
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Error in PUT /api/patterns/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
}
