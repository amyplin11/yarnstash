import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// `claude-sonnet-4-20250514` was retired on 2026-06-15 and now 404s with
// "model: claude-sonnet-4-20250514", which broke upload outright. Sonnet 5 is
// the documented successor for that tier — swap this constant to move tiers
// (e.g. 'claude-opus-5').
const SIZE_DETECTION_MODEL = 'claude-sonnet-5'

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
    },
    body: JSON.stringify({
      model: SIZE_DETECTION_MODEL,
      max_tokens: 1024,
      // Sonnet 5 runs adaptive thinking whenever `thinking` is omitted, and
      // thinking shares the max_tokens budget — the whole 1024 could be spent
      // before any JSON was emitted. This is a cheap lookup, so keep it off.
      thinking: { type: 'disabled' },
      // Replaces the old assistant prefill ({ role: 'assistant', content: '{' }),
      // which returns 400 on current models. The schema now guarantees the
      // response parses into this shape.
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              sizes: { type: 'array', items: { type: 'string' } },
            },
            required: ['sizes'],
            additionalProperties: false,
          },
        },
      },
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
  // Find the text block by type rather than indexing content[0]: when thinking
  // is on, the first block is a thinking block, not the answer.
  const responseText: string =
    data.content?.find((block: { type: string }) => block.type === 'text')?.text ?? ''

  try {
    const parsed = JSON.parse(responseText)
    const sizes = Array.isArray(parsed.sizes) ? parsed.sizes : []
    console.log('Extracted sizes:', sizes)
    return sizes
  } catch {
    console.error('Failed to parse sizes response:', responseText)
    return []
  }
}
