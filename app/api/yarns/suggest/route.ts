import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { peekBrandIndex, searchBrands, warmBrandIndex } from '@/lib/yarns/brand-index'
import { toPrefixTsQuery } from '@/lib/yarns/search-query'
import { mapWeightName, type YarnSuggestion } from '@/lib/types'

const MIN_QUERY_LENGTH = 2
const MAX_BRANDS = 4
const MAX_YARNS = 6

interface SuggestionRow {
  ravelry_id: number
  name: string
  yarn_company_name: string | null
  yarn_weight_name: string | null
  first_photo_url: string | null
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') || '').trim()

  const empty = { brands: [], yarns: [] }

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(empty)
  }

  const tsQuery = toPrefixTsQuery(query)
  if (!tsQuery) {
    return NextResponse.json(empty)
  }

  try {
    const supabase = createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('yarns')
      .select('ravelry_id, name, yarn_company_name, yarn_weight_name, first_photo_url')
      .eq('discontinued', false)
      .textSearch('search_vector', tsQuery, { config: 'english' })
      .order('rating_average', { ascending: false, nullsFirst: false })
      .limit(MAX_YARNS)

    if (error) {
      console.error('Error fetching yarn suggestions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const yarns: YarnSuggestion[] = ((data || []) as SuggestionRow[]).map((row) => ({
      id: row.ravelry_id.toString(),
      name: row.name,
      // Left empty rather than a placeholder: the client builds a search query
      // from brand + name, and a fake brand would match nothing.
      brand: row.yarn_company_name || '',
      weight: mapWeightName(row.yarn_weight_name),
      imageUrl: row.first_photo_url || undefined,
    }))

    // Only use the brand index if it is already warm — a keystroke must never
    // block on the catalog sweep. Otherwise start it so later keystrokes have it.
    const index = peekBrandIndex()
    if (!index) {
      warmBrandIndex(supabase)
    }

    return NextResponse.json({
      brands: index ? searchBrands(index, query, MAX_BRANDS) : [],
      yarns,
    })
  } catch (error) {
    console.error('Error in GET /api/yarns/suggest:', error)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}
