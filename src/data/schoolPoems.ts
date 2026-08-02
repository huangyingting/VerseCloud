import type { DynastyId, Poem, PoemVisualEffect } from '../types'
import { schoolPoemSeeds } from './schoolPoems.generated'
import {
  schoolPoemPlaceCorrections,
  type SchoolPoemPlaceCorrection,
} from './schoolPoemPlaces'

const dynastyApproximateYears: Record<DynastyId, number> = {
  'pre-qin': -500,
  han: 100,
  'wei-jin': 350,
  'southern-northern': 520,
  sui: 600,
  tang: 750,
  'five-dynasties': 940,
  song: 1120,
  yuan: 1320,
  ming: 1510,
  qing: 1780,
}

const effects: Array<{ id: PoemVisualEffect; label: string; accent: string }> = [
  { id: 'petals-embers', label: '花影 · 流光', accent: '#c98772' },
  { id: 'river-flight', label: '江流 · 归舟', accent: '#78b9ad' },
  { id: 'moon-fire', label: '明月 · 灯火', accent: '#aaa0c8' },
  { id: 'river-mist', label: '烟水 · 云岚', accent: '#82aaa0' },
  { id: 'sun-river', label: '长日 · 山河', accent: '#cfb975' },
  { id: 'cloud-crane', label: '长风 · 云鹤', accent: '#9fb4a0' },
  { id: 'waterfall', label: '飞泉 · 银河', accent: '#8da5c2' },
  { id: 'morning-rain', label: '朝雨 · 新绿', accent: '#9eb984' },
]

const dynastyEraLabels: Record<DynastyId, string> = {
  'pre-qin': '先秦教材篇目',
  han: '两汉教材篇目',
  'wei-jin': '魏晋教材篇目',
  'southern-northern': '南北朝教材篇目',
  sui: '隋代教材篇目',
  tang: '唐代教材篇目',
  'five-dynasties': '五代教材篇目',
  song: '宋代教材篇目',
  yuan: '元代教材篇目',
  ming: '明代教材篇目',
  qing: '清代教材篇目',
}

const dynastyYearLabels: Record<DynastyId, string> = {
  'pre-qin': '先秦',
  han: '汉代',
  'wei-jin': '魏晋',
  'southern-northern': '南北朝',
  sui: '隋代',
  tang: '唐代',
  'five-dynasties': '五代',
  song: '宋代',
  yuan: '元代',
  ming: '明代',
  qing: '清代',
}

function stableHash(value: string) {
  return [...value].reduce((hash, character) =>
    Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0, 2166136261)
}

export function schoolPoemTextKey(poem: Pick<Poem, 'lines'>) {
  return poem.lines.join('').replace(/[\s，。！？；、：：“”‘’（）()《》·,.!?;:'"-]/gu, '')
}

export const schoolPoems: Poem[] = schoolPoemSeeds.map((seed) => {
  const correction = (schoolPoemPlaceCorrections as Record<string, SchoolPoemPlaceCorrection>)[seed.sourceId]
  if (!correction) {
    throw new Error(`Missing individual place correction for school poem ${seed.sourceId} (${seed.title})`)
  }
  const hash = stableHash(seed.sourceId)
  const effect = effects[hash % effects.length]
  const year = dynastyApproximateYears[seed.dynasty]

  return {
    id: `school-${seed.sourceId}`,
    title: seed.title,
    author: seed.author,
    dynasty: seed.dynasty,
    year,
    yearLabel: dynastyYearLabels[seed.dynasty],
    eraLabel: dynastyEraLabels[seed.dynasty],
    lines: seed.lines,
    longitude: correction.longitude,
    latitude: correction.latitude,
    placeId: correction.placeId,
    placeName: correction.placeName,
    relation: correction.relation,
    confidence: correction.confidence,
    evidence: correction.evidence,
    sourceLabel: '统编语文古诗词篇目 · 公开古籍校订',
    sourceUrl: `https://www.gushiwen.cn/shiwenv_${seed.sourceId}.aspx`,
    accent: effect.accent,
    visualEffect: effect.id,
    visualEffectLabel: effect.label,
    curriculumLevels: seed.curriculumLevels,
  }
})
