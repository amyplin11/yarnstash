import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Phase 1: Upload PDF to storage + extract available sizes via a lightweight Claude call
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()

    // Upload PDF to Supabase Storage
    const storagePath = `${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('pattern-pdfs')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return NextResponse.json(
        { error: `Failed to upload PDF: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Extract sizes from the PDF using a lightweight Claude call
    const base64PDF = Buffer.from(buffer).toString('base64')
    const sizes = await extractSizesFromPDF(base64PDF)

    return NextResponse.json({
      sizes,
      storagePath,
      fileName: file.name,
    })
  } catch (error) {
    console.error('Error in pattern upload:', error)
    const message = error instanceof Error ? error.message : 'Failed to process pattern'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function extractSizesFromPDF(base64PDF: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You MUST respond with ONLY valid JSON. No prose, no markdown, no code fences.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64PDF,
              },
            },
            {
              type: 'text',
              text: `Extract ONLY the available sizes from this knitting pattern.

Sizes are often listed in a format like "XXS (XS) S (M) L (XL) 2XL (3XL) 4XL (5XL)" where each individual size is a separate entry — some may be in parentheses. Split them into individual sizes.

Other common formats:
- "Small, Medium, Large, X-Large"
- "S/M/L/XL"
- "32 (34, 36, 38, 40, 42)"  (numeric chest/bust sizes)
- A table with size columns

Return a JSON object: { "sizes": ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] }

If the pattern is one-size / no sizes listed, return: { "sizes": [] }

Return ONLY the JSON object.`,
            },
          ],
        },
        {
          role: 'assistant',
          content: '{',
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Anthropic API error (sizes):', response.status, errorData)
    const apiMessage = errorData?.error?.message || `API returned ${response.status}`
    throw new Error(`Claude API error: ${apiMessage}`)
  }

  const data = await response.json()
  const responseText = data.content[0]?.type === 'text' ? data.content[0].text : ''

  try {
    const parsed = JSON.parse('{' + responseText)
    const sizes = Array.isArray(parsed.sizes) ? parsed.sizes : []
    console.log('Extracted sizes:', sizes)
    return sizes
  } catch {
    console.error('Failed to parse sizes response:', '{' + responseText)
    return []
  }
}
