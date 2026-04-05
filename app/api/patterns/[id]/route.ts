import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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

    // Fetch pattern
    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    // Fetch related data in parallel
    const [detailsRes, materialsRes, sectionsRes, wipRes] = await Promise.all([
      supabase
        .from('pattern_details')
        .select('*')
        .eq('pattern_id', id)
        .single(),
      supabase
        .from('pattern_materials')
        .select('*')
        .eq('pattern_id', id)
        .order('color_order'),
      supabase
        .from('pattern_sections')
        .select('*')
        .eq('pattern_id', id)
        .order('section_order'),
      supabase
        .from('user_pattern_progress')
        .select('*')
        .eq('pattern_id', id)
        .eq('user_id', user.id)
        .single(),
    ])

    // Fetch instructions for each section
    const sectionIds = (sectionsRes.data || []).map((s: { id: string }) => s.id)
    let instructions: Record<string, unknown[]> = {}

    if (sectionIds.length > 0) {
      const { data: allInstructions } = await supabase
        .from('pattern_instructions')
        .select('*')
        .in('section_id', sectionIds)
        .order('step_number')

      if (allInstructions) {
        for (const instr of allInstructions) {
          if (!instructions[instr.section_id]) {
            instructions[instr.section_id] = []
          }
          instructions[instr.section_id].push(instr)
        }
      }
    }

    // Combine sections with their instructions
    const sections = (sectionsRes.data || []).map((section: { id: string }) => ({
      ...section,
      instructions: instructions[section.id] || [],
    }))

    return NextResponse.json({
      pattern,
      details: detailsRes.data || null,
      materials: materialsRes.data || [],
      sections,
      wip: wipRes.data || null,
    })
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]:', error)
    return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Fetch the pattern to get the PDF path for storage cleanup
    const { data: pattern, error: fetchError } = await supabase
      .from('patterns')
      .select('id, user_id, pdf_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    // Delete the PDF from storage if it exists
    if (pattern.pdf_url) {
      const storagePath = `${user.id}/${pattern.pdf_url.split(`${user.id}/`).pop()}`
      await supabase.storage.from('pattern-pdfs').remove([storagePath])
    }

    // Delete the pattern (cascades to details, materials, sections, instructions, glossary)
    const { error: deleteError } = await supabase
      .from('patterns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting pattern:', deleteError)
      return NextResponse.json({ error: 'Failed to delete pattern' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/patterns/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete pattern' }, { status: 500 })
  }
}
