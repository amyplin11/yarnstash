import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

// Size detection is a small, fast call, but it still reads the whole PDF.
export const maxDuration = 60

// See lib/patterns/extract-job.ts — kept in sync with the extraction model.
const SIZE_DETECTION_MODEL = 'claude-sonnet-5'

// The response here is small and flat, so unlike the full extraction it fits
// within the structured-output schema limits. This guarantees valid JSON and
// replaces the old assistant-prefill trick, which 400s on current models.
const SIZES_SCHEMA = {
  type: 'object',
  properties: {
    sizes: {
      type: 'array',
      description: 'Individual size names, in the order listed. Empty if one-size.',
      items: { type: 'string' },
    },
  },
  required: ['sizes'],
  additionalProperties: false,
}

// Phase 1: Upload PDF to storage + extract available sizes via a lightweight Claude call
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic()

  const response = await client.messages.create({
    model: SIZE_DETECTION_MODEL,
    max_tokens: 1024,
    // This is a lookup, not a reasoning task; Sonnet 5 would otherwise run
    // adaptive thinking by default and spend part of the budget on it.
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema: SIZES_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
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

If the pattern is one-size / no sizes listed, return an empty array.`,
          },
        ],
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming)

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  try {
    const parsed = JSON.parse(responseText)
    const sizes: string[] = Array.isArray(parsed.sizes) ? parsed.sizes : []
    console.log('Extracted sizes:', sizes)
    return sizes
  } catch {
    // Structured outputs makes this near-impossible, but a size-detection
    // failure shouldn't sink the upload — fall back to "no sizes", which sends
    // the user straight to a full extraction.
    console.error('Failed to parse sizes response:', responseText.slice(0, 300))
    return []
  }
}
