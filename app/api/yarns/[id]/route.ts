import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const ravelryId = parseInt(id, 10)

    if (isNaN(ravelryId)) {
      return NextResponse.json({ error: 'Invalid yarn ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('yarns')
      .select('*, yarn_fibers(*), yarn_photos(*)')
      .eq('ravelry_id', ravelryId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Yarn not found' }, { status: 404 })
      }
      console.error('Error fetching yarn:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ yarn: data })
  } catch (error) {
    console.error('Error in GET /api/yarns/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch yarn' },
      { status: 500 }
    )
  }
}
