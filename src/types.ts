export type DynastyId = 'tang' | 'song' | 'yuan' | 'ming'

export type PlaceRelation =
  | 'composed_at'
  | 'setting'
  | 'mentioned'
  | 'route'
  | 'associated'

export type Confidence = 'high' | 'medium' | 'low'

export type PoemVisualEffect =
  | 'petals-embers'
  | 'river-flight'
  | 'moon-fire'
  | 'river-mist'
  | 'sun-river'
  | 'cloud-crane'
  | 'waterfall'
  | 'morning-rain'

export interface Poem {
  id: string
  title: string
  author: string
  dynasty: DynastyId
  lines: string[]
  longitude: number
  latitude: number
  placeName: string
  relation: PlaceRelation
  confidence: Confidence
  evidence: string
  sourceLabel: string
  sourceUrl: string
  accent: string
  visualEffect: PoemVisualEffect
  visualEffectLabel: string
}

export interface MapSnapshot {
  id: string
  dynasty: DynastyId
  dynastyLabel: string
  eraLabel: string
  year: number
  status: 'published' | 'planned'
  note: string
  boundary?: number[][][][]
}

export interface ScenePoint {
  x: number
  y: number
}

export interface SoundscapeMix {
  changan: number
  jiangnan: number
  frontier: number
  dominant: 'changan' | 'jiangnan' | 'frontier'
}
