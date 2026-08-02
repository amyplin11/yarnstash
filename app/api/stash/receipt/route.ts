import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { RECEIPT_PROMPT, RECEIPT_SCHEMA } from '@/lib/yarns/receipt-prompt'

// A receipt can be a multi-page PDF, and this reads every line item off it.
export const maxDuration = 60

// Kept in sync with the ball-band reader in ../analyze.
const RECEIPT_MODEL = 'claude-opus-5'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
const PDF_TYPE = 'application/pdf'
const MAX_BYTES = 12 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Receipt reading is not configured on this server' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const receipt = formData.get('receipt')

    if (!(receipt instanceof File)) {
      return NextResponse.json({ error: 'No receipt provided' }, { status: 400 })
    }

    const isPdf = receipt.type === PDF_TYPE
    const isImage = (IMAGE_TYPES as readonly string[]).includes(receipt.type)
    if (!isPdf && !isImage) {
      // lib/images/to-jpeg.ts re-encodes photos (HEIC included) before upload,
      // so anything else here is a genuinely unsupported file.
      return NextResponse.json(
        { error: 'Please upload a PDF, or a JPEG, PNG, GIF, or WebP image' },
        { status: 400 }
      )
    }
    if (receipt.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That file is too large — please use one under 12MB' },
        { status: 400 }
      )
    }

    const base64 = Buffer.from(await receipt.arrayBuffer()).toString('base64')
    const client = new Anthropic()

    const source = isPdf
      ? ({ type: 'base64', media_type: PDF_TYPE, data: base64 } as const)
      : ({ type: 'base64', media_type: receipt.type as 'image/jpeg', data: base64 } as const)

    const response = await client.messages.create({
      model: RECEIPT_MODEL,
      max_tokens: 8192,
      // Unlike a ball band, this is a reasoning task: line items have to be
      // split into brand vs yarn name and separated from shipping and tax.
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            isPdf
              ? { type: 'document', source }
              : { type: 'image', source },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Couldn't read anything from that receipt. Try a clearer copy." },
        { status: 422 }
      )
    }

    return NextResponse.json(JSON.parse(text))
  } catch (error) {
    console.error('Error in POST /api/stash/receipt:', error)
    return NextResponse.json({ error: 'Failed to read the receipt' }, { status: 500 })
  }
}
