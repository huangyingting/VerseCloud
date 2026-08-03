import type { Poem, PoemVisualEffect } from '../types'
import { schoolPoemSeeds } from './schoolPoems.generated'
import {
  schoolPoemPlaceCorrections,
  type SchoolPoemPlaceCorrection,
} from './schoolPoemPlaces'
import {
  schoolPoemDateCorrections,
  type SchoolPoemDateCorrection,
} from './schoolPoemDates'

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
  const date = (schoolPoemDateCorrections as Record<string, SchoolPoemDateCorrection>)[seed.sourceId]
  if (!date) {
    throw new Error(`Missing individual date correction for school poem ${seed.sourceId} (${seed.title})`)
  }
  const hash = stableHash(seed.sourceId)
  const effect = effects[hash % effects.length]

  return {
    id: `school-${seed.sourceId}`,
    title: seed.title,
    author: seed.author,
    dynasty: seed.dynasty,
    year: date.year,
    yearLabel: date.yearLabel,
    eraLabel: date.eraLabel,
    datePrecision: date.datePrecision,
    dateEvidence: date.dateEvidence,
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
