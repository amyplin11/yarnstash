import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { instructionBelongsToPattern } from '@/lib/patterns/instruction-ownership'

const MAX_COUNTERS_PER_PATTERN = 20
const MAX_NAME_LENGTH = 60

/**
 * The hosted database predates migration tracking, so pattern_counters — or
 * its instruction_id column, added later — may not exist yet on a given
 * project. Distinguish that from a real failure, so the UI can say "run the
 * migration" instead of showing a generic error.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === 'PGRST205' || // table missing from the schema cache
    error?.code === 'PGRST204' || // column missing from the schema cache
    error?.code === '42P01' || // undefined_table
    error?.code === '42703' // undefined_column
  )
}

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

    const { data: counters, error } = await supabase
      .from('pattern_counters')
      .select('*')
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .order('position')
      .order('created_at')

    if (error) {
      if (isMissingSchema(error)) {
        return NextResponse.json(
          { error: 'Stitch counters are not set up yet', setupRequired: true },
          { status: 503 }
        )
      }
      console.error('Error fetching counters:', error)
      return NextResponse.json({ error: 'Failed to fetch counters' }, { status: 500 })
    }

    return NextResponse.json({ counters: counters || [] })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/counters:', error)
    return NextResponse.json({ error: 'Failed to fetch counters' }, { status: 500 })
  }
}

export async function POST(
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

    // Only counters on a pattern the caller owns. RLS on pattern_counters keys
    // off user_id alone, so without this a valid user could hang a counter off
    // someone else's pattern id.
    const { data: pattern } = await supabase
      .from('patterns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    const rawName = typeof body.name === 'string' ? body.name.trim() : ''
    if (rawName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
        { status: 400 }
      )
    }

    // A counter may be pinned to one instruction, or left pattern-wide (null).
    let instructionId: string | null = null
    if (body.instruction_id !== undefined && body.instruction_id !== null) {
      if (typeof body.instruction_id !== 'string') {
        return NextResponse.json({ error: 'instruction_id must be a string' }, { status: 400 })
      }
      if (!(await instructionBelongsToPattern(supabase, body.instruction_id, id))) {
        return NextResponse.json(
          { error: 'That step is not part of this pattern' },
          { status: 400 }
        )
      }
      instructionId = body.instruction_id
    }

    const { data: existing, error: existingError } = await supabase
      .from('pattern_counters')
      .select('position')
      .eq('pattern_id', id)
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(MAX_COUNTERS_PER_PATTERN)

    if (existingError) {
      if (isMissingSchema(existingError)) {
        return NextResponse.json(
          { error: 'Stitch counters are not set up yet', setupRequired: true },
          { status: 503 }
        )
      }
      console.error('Error reading counters before insert:', existingError)
      return NextResponse.json({ error: 'Failed to create counter' }, { status: 500 })
    }

    if ((existing?.length ?? 0) >= MAX_COUNTERS_PER_PATTERN) {
      return NextResponse.json(
        { error: `A pattern can have at most ${MAX_COUNTERS_PER_PATTERN} counters` },
        { status: 400 }
      )
    }

    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

    const { data: counter, error } = await supabase
      .from('pattern_counters')
      .insert({
        user_id: user.id,
        pattern_id: id,
        instruction_id: instructionId,
        name: rawName || 'Counter',
        value: 0,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      if (isMissingSchema(error)) {
        return NextResponse.json(
          { error: 'Stitch counters are not set up yet', setupRequired: true },
          { status: 503 }
        )
      }
      console.error('Error creating counter:', error)
      return NextResponse.json({ error: 'Failed to create counter' }, { status: 500 })
    }

    return NextResponse.json({ counter }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/patterns/[id]/counters:', error)
    return NextResponse.json({ error: 'Failed to create counter' }, { status: 500 })
  }
}
