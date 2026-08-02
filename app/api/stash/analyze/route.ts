import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'

// Reading a ball band is a short vision extraction. Change this one constant to
// move tiers (the pattern routes currently run on 'claude-sonnet-5').
const LABEL_MODEL = 'claude-opus-5'

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 8 * 1024 * 1024

/** Mirrors the weights the add-yarn form offers, so the value drops straight in. */
const WEIGHTS = [
  'lace',
  'light-fingering',
  'fingering',
  'sport',
  'dk',
  'worsted',
  'aran',
  'bulky',
  'super-bulky',
  'jumbo',
]

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const YARN_LABEL_SCHEMA = {
  type: 'object',
  properties: {
    brand: nullableString,
    name: nullableString,
    colorway: nullableString,
    weight: { anyOf: [{ type: 'string', enum: WEIGHTS }, { type: 'null' }] },
    fiber_content: nullableString,
    yardage: nullableNumber,
    grams_per_skein: nullableNumber,
  },
  required: [
    'brand',
    'name',
    'colorway',
    'weight',
    'fiber_content',
    'yardage',
    'grams_per_skein',
  ],
  additionalProperties: false,
}

const PROMPT = `This is a photo of a yarn ball band (the paper label wrapped around a skein), or of the skein itself.

Read the label and return what you can actually see:
- brand: the manufacturer or dyer (e.g. "Malabrigo", "Cascade")
- name: the yarn line (e.g. "Rios", "220 Superwash") — not the brand, not the colorway
- colorway: the colour name and/or number
- weight: normalise to one of the listed values. Ball bands often show a yarn-weight symbol or a craft-council number: 0 = lace, 1 = fingering, 2 = sport, 3 = dk, 4 = worsted, 5 = bulky, 6 = super-bulky, 7 = jumbo. "Aran" and "10 ply" are aran; "8 ply" is dk; "4 ply" is fingering.
- fiber_content: as printed, e.g. "100% superwash merino wool"
- yardage: yards per skein, as a number. Labels often print both yards and metres — return YARDS. If only metres are given, convert (1 m = 1.0936 yd) and round to the nearest yard.
- grams_per_skein: grams per skein, as a number

Return null for any field you cannot read with confidence. Do not guess a brand or colorway from the yarn's appearance — only report what is legible on the label.`

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Photo analysis is not configured on this server' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const image = formData.get('image')

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    if (!SUPPORTED_TYPES.includes(image.type)) {
      // The browser re-encodes to JPEG before upload, so a HEIC arriving here
      // means that step was skipped or failed — say so rather than "bad file".
      const heic = /heic|heif/i.test(image.type)
      return NextResponse.json(
        {
          error: heic
            ? "HEIC photos need converting first — open YarnStash in Safari on your iPhone, or shoot in Most Compatible mode."
            : 'Please use a JPEG, PNG, GIF, or WebP photo',
        },
        { status: 400 }
      )
    }
    if (image.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That photo is too large — please use one under 8MB' },
        { status: 400 }
      )
    }

    const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')
    const client = new Anthropic()

    const response = await client.messages.create({
      model: LABEL_MODEL,
      max_tokens: 1024,
      // Reading a label is recognition, not reasoning; thinking would otherwise
      // eat into the token budget for no gain.
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: YARN_LABEL_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.type as 'image/jpeg', data: base64 },
            },
            { type: 'text', text: PROMPT },
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
        { error: "Couldn't read anything from that photo. Try again with the label in focus." },
        { status: 422 }
      )
    }

    return NextResponse.json({ yarn: JSON.parse(text) })
  } catch (error) {
    console.error('Error in POST /api/stash/analyze:', error)
    return NextResponse.json({ error: 'Failed to analyze the photo' }, { status: 500 })
  }
}
