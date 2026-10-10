import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPatternImages, pdfStoragePath } from '@/lib/patterns/pattern-images'

// Patterns uploaded before image extraction existed are processed on their
// first view, which downloads and scans the whole PDF.
export const maxDuration = 60

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

    // Ownership is established here, under RLS, before anything touches
    // storage with the service-role client below.
    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .select('id, pdf_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    if (!pattern.pdf_url) {
      return NextResponse.json({ images: [] })
    }

    const images = await getPatternImages(
      createAdminClient(),
      userId,
      pattern.id,
      pdfStoragePath(pattern.pdf_url, userId)
    )

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/images:', error)
    return NextResponse.json({ error: 'Failed to load pattern images' }, { status: 500 })
  }
}
