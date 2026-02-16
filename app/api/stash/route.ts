import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

    const { data, error } = await supabase
      .from('stash_yarns')
      .insert({
        user_id: user.id,
        ...body,
      })
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
