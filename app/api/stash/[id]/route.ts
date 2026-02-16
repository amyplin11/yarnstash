import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// PUT - Update stash yarn
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('stash_yarns')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating stash yarn:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('stash_yarns')
      .delete()
      .eq('id', params.id)
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
