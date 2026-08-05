/**
 * Columns a client is allowed to set on a `stash_yarns` row; anything else in
 * a request body is ignored. Shared by the create route and the update route
 * so the two can't drift apart — a column added to one and not the other is
 * how a write path quietly stops accepting a field it should.
 */
export const TEXT_FIELDS = [
  'ravelry_yarn_id',
  'brand',
  'name',
  'colorway',
  'weight',
  'fiber_content',
  'location',
  'notes',
  'image_url',
  'purchase_date',
] as const

export const NUMBER_FIELDS = ['yardage', 'grams_per_skein', 'skeins', 'purchase_price'] as const

/** The stash carries whole skeins, and a row with none of a yarn is a deletion. */
export const MIN_SKEINS = 1
