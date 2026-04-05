// === Yarn weight classification ===

export type YarnWeight =
  | 'thread'
  | 'cobweb'
  | 'lace'
  | 'light-fingering'
  | 'fingering'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'aran'
  | 'bulky'
  | 'super-bulky'
  | 'jumbo'
  | 'no-weight'

// === Existing types (used by UI components) ===

export interface Yarn {
  id: string
  brand: string
  name: string
  weight: YarnWeight
  fiberContent: string
  yardage: number
  gramsPerSkein: number
  price?: number
  imageUrl?: string
  colors?: Colorway[]
}

export interface Colorway {
  id: string
  name: string
  hexCode?: string
  imageUrl?: string
}

export interface StashYarn {
  id: string
  yarn: Yarn
  colorway: string
  skeins: number
  purchaseDate?: Date
  purchasePrice?: number
  location?: string
  notes?: string
}

// === Global yarn catalog types (from Ravelry import) ===

export interface CatalogYarn {
  ravelry_id: number
  name: string
  permalink: string | null

  yarn_company_name: string | null
  yarn_company_id: number | null

  yarn_weight_id: number | null
  yarn_weight_name: string | null
  yarn_weight_ply: string | null
  yarn_weight_knit_gauge: string | null
  yarn_weight_crochet_gauge: string | null
  yarn_weight_wpi: string | null

  grams: number | null
  yardage: number | null
  wpi: number | null
  thread_size: string | null
  texture: string | null

  gauge_divisor: number | null
  min_gauge: number | null
  max_gauge: number | null

  min_needle_size_us: string | null
  max_needle_size_us: string | null
  min_needle_size_metric: number | null
  max_needle_size_metric: number | null
  min_hook_size_us: string | null
  max_hook_size_us: string | null
  min_hook_size_metric: number | null
  max_hook_size_metric: number | null

  discontinued: boolean
  machine_washable: boolean | null

  rating_average: number | null
  rating_count: number
  rating_total: number

  notes_html: string | null
  fiber_content: string | null
  first_photo_url: string | null

  yarn_fibers?: CatalogYarnFiber[]
  yarn_photos?: CatalogYarnPhoto[]

  imported_at: string
  updated_at: string
}

export interface CatalogYarnFiber {
  id: number
  yarn_ravelry_id: number
  fiber_type_id: number | null
  fiber_type_name: string | null
  percentage: number | null
}

export interface CatalogYarnPhoto {
  id: number
  yarn_ravelry_id: number
  ravelry_photo_id: number | null
  sort_order: number
  square_url: string | null
  small_url: string | null
  small2_url: string | null
  medium_url: string | null
  medium2_url: string | null
  shelved_url: string | null
}

// === Search/filter types ===

export interface YarnSearchParams {
  query?: string
  weight?: string
  brand?: string
  discontinued?: boolean
  sort?: 'name' | 'rating' | 'company' | 'newest'
  page?: number
  pageSize?: number
}

export interface YarnSearchResult {
  yarns: CatalogYarn[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// === Conversion: CatalogYarn -> Yarn (for existing UI components) ===

export function catalogYarnToYarn(catalog: CatalogYarn): Yarn {
  return {
    id: catalog.ravelry_id.toString(),
    brand: catalog.yarn_company_name || 'Unknown Brand',
    name: catalog.name,
    weight: mapWeightName(catalog.yarn_weight_name),
    fiberContent: catalog.fiber_content || 'Unknown',
    yardage: catalog.yardage || 0,
    gramsPerSkein: catalog.grams || 0,
    imageUrl: catalog.first_photo_url || undefined,
    colors: [],
  }
}

export function mapWeightName(name: string | null | undefined): YarnWeight {
  if (!name) return 'no-weight'
  const w = name.toLowerCase()
  if (w.includes('thread')) return 'thread'
  if (w.includes('cobweb')) return 'cobweb'
  if (w === 'lace') return 'lace'
  if (w.includes('light fingering')) return 'light-fingering'
  if (w.includes('fingering') || w.includes('sock')) return 'fingering'
  if (w.includes('sport') || w.includes('baby')) return 'sport'
  if (w.includes('dk') || w.includes('light worsted')) return 'dk'
  if (w.includes('worsted') || w.includes('afghan')) return 'worsted'
  if (w.includes('aran')) return 'aran'
  if (w.includes('super bulky')) return 'super-bulky'
  if (w.includes('bulky') || w.includes('chunky')) return 'bulky'
  if (w.includes('jumbo') || w.includes('roving')) return 'jumbo'
  return 'no-weight'
}
