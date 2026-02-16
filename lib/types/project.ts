export interface Project {
  id: string
  name: string
  pattern: string
  patternUrl?: string
  imageUrl?: string
  status: 'queued' | 'in-progress' | 'completed' | 'frogged'
  needleSize?: string
  gauge?: string
  yarn: YarnInProject[]
  notes?: string
  startDate?: Date
  endDate?: Date
  tags?: string[]
  difficulty?: 'beginner' | 'easy' | 'intermediate' | 'advanced'
  // Ravelry-specific fields for Phase 3
  ravelryId?: number
  designer?: string
}

export interface YarnInProject {
  yarnId: string
  yarnName: string
  colorway: string
  skeinsNeeded: number
  skeinsUsed?: number
}
