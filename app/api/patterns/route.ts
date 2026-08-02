import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // The embedded progress row is what marks a pattern as "on the needles".
    // RLS on user_pattern_progress already scopes it to this user.
    const { data, error } = await supabase
      .from('patterns')
      .select('*, user_pattern_progress(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching patterns:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten the one-row embed into a single `progress` field.
    const patterns = (data || []).map(({ user_pattern_progress, ...pattern }) => ({
      ...pattern,
      progress: user_pattern_progress?.[0] ?? null,
    }))

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('Error in GET /api/patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    )
  }
}
