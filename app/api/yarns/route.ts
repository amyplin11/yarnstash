import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query') || ''
  const weight = searchParams.get('weight') || ''
  const brand = searchParams.get('brand') || ''
  const discontinued = searchParams.get('discontinued')
  const sort = searchParams.get('sort') || 'rating'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('page_size') || '40', 10)

  try {
    const supabase = createServerClient()

    // Select everything except raw_data (too large for list views)
    let dbQuery = supabase
      .from('yarns')
      .select(
        `ravelry_id, name, permalink,
         yarn_company_name, yarn_company_id,
         yarn_weight_id, yarn_weight_name, yarn_weight_ply,
         yarn_weight_knit_gauge, yarn_weight_crochet_gauge, yarn_weight_wpi,
         grams, yardage, wpi, thread_size, texture,
         gauge_divisor, min_gauge, max_gauge,
         min_needle_size_us, max_needle_size_us, min_needle_size_metric, max_needle_size_metric,
         min_hook_size_us, max_hook_size_us, min_hook_size_metric, max_hook_size_metric,
         discontinued, machine_washable,
         rating_average, rating_count, rating_total,
         notes_html, fiber_content, first_photo_url,
         imported_at, updated_at,
         yarn_fibers(*), yarn_photos(*)`,
        { count: 'exact' }
      )

    // Full-text search
    if (query.trim()) {
      dbQuery = dbQuery.textSearch('search_vector', query, {
        type: 'websearch',
        config: 'english',
      })
    }

    // Weight filter
    if (weight) {
      const weights = weight.split(',').map((w) => w.trim())
      dbQuery = dbQuery.in('yarn_weight_name', weights)
    }

    // Brand filter
    if (brand) {
      dbQuery = dbQuery.ilike('yarn_company_name', `%${brand}%`)
    }

    // Discontinued filter
    if (discontinued === 'false') {
      dbQuery = dbQuery.eq('discontinued', false)
    } else if (discontinued === 'true') {
      dbQuery = dbQuery.eq('discontinued', true)
    }

    // Sorting
    switch (sort) {
      case 'name':
        dbQuery = dbQuery.order('name', { ascending: true })
        break
      case 'company':
        dbQuery = dbQuery.order('yarn_company_name', { ascending: true })
        break
      case 'newest':
        dbQuery = dbQuery.order('imported_at', { ascending: false })
        break
      case 'rating':
      default:
        dbQuery = dbQuery.order('rating_average', { ascending: false, nullsFirst: false })
        break
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    dbQuery = dbQuery.range(from, to)

    const { data, error, count } = await dbQuery

    if (error) {
      console.error('Error searching yarns:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      yarns: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    })
  } catch (error) {
    console.error('Error in GET /api/yarns:', error)
    return NextResponse.json(
      { error: 'Failed to search yarns' },
      { status: 500 }
    )
  }
}
