import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query') || ''
  const page = searchParams.get('page') || '1'
  const pageSize = searchParams.get('page_size') || '20'

  try {
    // Construct Ravelry API URL
    const ravelryUrl = new URL('https://api.ravelry.com/yarns/search.json')
    ravelryUrl.searchParams.set('query', query)
    ravelryUrl.searchParams.set('page', page)
    ravelryUrl.searchParams.set('page_size', pageSize)

    // Get credentials from environment
    const username = process.env.RAVELRY_USERNAME
    const password = process.env.RAVELRY_PASSWORD

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Ravelry API credentials not configured' },
        { status: 500 }
      )
    }

    // Make request to Ravelry API with Basic Auth
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

    const response = await fetch(ravelryUrl.toString(), {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ravelry API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Ravelry API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching yarns from Ravelry:', error)
    return NextResponse.json(
      { error: 'Failed to fetch yarns from Ravelry' },
      { status: 500 }
    )
  }
}
