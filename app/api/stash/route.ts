import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { MIN_SKEINS, NUMBER_FIELDS, TEXT_FIELDS } from '@/lib/stash/fields'

// GET all stash yarns
export async function GET() {
  try {
    const supabase = createServerClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('stash_yarns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching stash:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ yarns: data || [] })
  } catch (error) {
    console.error('Error in GET /api/stash:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stash yarns' },
      { status: 500 }
    )
  }
}

// Shared with the update route in ./[id] so both write paths accept the same
// columns.


// POST - Add yarn to stash
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!body?.brand?.trim() || !body?.name?.trim()) {
      return NextResponse.json(
        { error: 'Brand and yarn name are required' },
        { status: 400 }
      )
    }

    // Whitelist rather than spreading the body — an unknown key would otherwise
    // fail the insert with an opaque 500.
    const record: Record<string, unknown> = { user_id: user.id }
    for (const field of TEXT_FIELDS) {
      const value = body[field]
      if (typeof value === 'string' && value.trim()) record[field] = value.trim()
    }
    for (const field of NUMBER_FIELDS) {
      const value = Number(body[field])
      if (body[field] !== undefined && body[field] !== '' && Number.isFinite(value)) {
        record[field] = value
      }
    }
    record.skeins = Math.max(MIN_SKEINS, Number(record.skeins) || MIN_SKEINS)

    const { data, error } = await supabase
      .from('stash_yarns')
      .insert(record)
      .select()
      .single()

    if (error) {
      console.error('Error adding to stash:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ yarn: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/stash:', error)
    return NextResponse.json(
      { error: 'Failed to add yarn to stash' },
      { status: 500 }
    )
  }
}
