import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getBrandIndex, searchBrands } from '@/lib/yarns/brand-index'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const requestedLimit = parseInt(searchParams.get('limit') || '', 10)
  const limit = Math.min(
    Math.max(Number.isNaN(requestedLimit) ? DEFAULT_LIMIT : requestedLimit, 1),
    MAX_LIMIT
  )

  try {
    const supabase = createServerClient()

    // The catalog is only readable by authenticated users. Without this check
    // an anonymous request would sweep zero rows and could poison the cache.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First call per server instance builds the index (a few seconds); the
    // brand filter shows a loading state while that happens.
    const brands = await getBrandIndex(supabase)

    return NextResponse.json({
      brands: searchBrands(brands, query, limit),
      total: brands.length,
    })
  } catch (error) {
    console.error('Error in GET /api/yarns/brands:', error)
    return NextResponse.json({ error: 'Failed to load yarn brands' }, { status: 500 })
  }
}
