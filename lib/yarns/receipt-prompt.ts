/**
 * The receipt-reading contract: what we ask Claude for and the shape we accept
 * back. Kept beside the yarn-matching helpers rather than inside the route so
 * it can be exercised directly, the same way lib/patterns/extraction-prompt.ts
 * is separate from the pattern route.
 */

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] }

export const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    retailer: nullableString,
    order_date: nullableString,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          brand: nullableString,
          name: nullableString,
          colorway: nullableString,
          quantity: nullableNumber,
          line_total: nullableNumber,
        },
        required: ['brand', 'name', 'colorway', 'quantity', 'line_total'],
        additionalProperties: false,
      },
    },
  },
  required: ['retailer', 'order_date', 'items'],
  additionalProperties: false,
}

export const RECEIPT_PROMPT = `This is a receipt, order confirmation, or order-summary page from a yarn purchase.

Return one entry per YARN line item. A single line usually looks like:

    "Knitting for Olive Soft Silk Mohair - Linen × 4     $40.12"

which is brand "Knitting for Olive", name "Soft Silk Mohair", colorway "Linen", quantity 4, line_total 40.12.

For each yarn line:
- brand: the manufacturer or dyer. Retailers usually print the brand and the yarn line run together — split them. Common brands include Knitting for Olive, Malabrigo, Isager, Sandnes Garn, Holst Garn, De Rerum Natura, Ranco, BC Garn, Cascade, Drops, Rowan. Multi-word brands are normal; "Knitting for Olive Merino" is the brand "Knitting for Olive" and the yarn "Merino", NOT a brand called "Knitting".
- name: the yarn line only — no brand, no colorway. e.g. "Soft Silk Mohair", "Rios", "Tynn Silk Mohair".
- colorway: the colour name and/or number, often after a dash or comma.
- quantity: number of skeins/balls. Usually after "×", "x", "Qty", or in its own column. Default to 1 if the line clearly represents one skein and no quantity is shown.
- line_total: the price for the WHOLE line, as a number with no currency symbol. If the receipt shows only a per-unit price, multiply it by the quantity. If no price is legible, return null.

Rules:
- ONLY include actual yarn products. Skip shipping, postage, tax, VAT, discounts, gift cards, order totals, subtotals, needles, notions, patterns, books, and bags.
- Return null for any field you cannot read with confidence. Do not invent a colorway or a brand.
- retailer: the shop the order was placed with, if shown.
- order_date: the order or purchase date as YYYY-MM-DD, if shown. Return null if you cannot determine it confidently.
- If the page shows no yarn line items at all, return an empty items array.`

