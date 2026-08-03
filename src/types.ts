export type DynastyId =
  | 'pre-qin'
  | 'han'
  | 'wei-jin'
  | 'southern-northern'
  | 'sui'
  | 'tang'
  | 'five-dynasties'
  | 'song'
  | 'yuan'
  | 'ming'
  | 'qing'

export type PlaceRelation =
  | 'composed_at'
  | 'setting'
  | 'mentioned'
  | 'route'
  | 'associated'

export type Confidence = 'high' | 'medium' | 'low'

export type DatePrecision = 'exact' | 'circa' | 'range' | 'period' | 'disputed'

export type SchoolLevel = 'primary' | 'middle'

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
  year: number
  yearLabel: string
  eraLabel: string
  datePrecision: DatePrecision
  dateEvidence: string
  lines: string[]
  longitude: number
  latitude: number
  placeId: string
  placeName: string
  relation: PlaceRelation
  confidence: Confidence
  evidence: string
  sourceLabel: string
  sourceUrl: string
  accent: string
  visualEffect: PoemVisualEffect
  visualEffectLabel: string
  curriculumLevels?: SchoolLevel[]
}

export interface MapSnapshot {
  id: string
  dynasty: DynastyId
  dynastyLabel: string
  eraLabel: string
  year: number
  startYear: number
  endYear: number
  dateRange: string
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
