export type YarnWeight =
  | 'lace'
  | 'fingering'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'aran'
  | 'bulky'
  | 'super-bulky'
  | 'jumbo'

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
