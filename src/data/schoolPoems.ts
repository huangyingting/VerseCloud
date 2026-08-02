import type { DynastyId, Poem, PoemVisualEffect } from '../types'
import { schoolPoemSeeds } from './schoolPoems.generated'

interface PlaceProfile {
  year: number
  placeName: string
  longitude: number
  latitude: number
}

const dynastyProfiles: Record<DynastyId, PlaceProfile> = {
  'pre-qin': { year: -500, placeName: '先秦中原文化区域', longitude: 113.6, latitude: 34.7 },
  han: { year: 100, placeName: '两汉文化区域', longitude: 112.4, latitude: 34.5 },
  'wei-jin': { year: 350, placeName: '魏晋文化区域', longitude: 113.1, latitude: 34.3 },
  'southern-northern': { year: 520, placeName: '南北朝文化区域', longitude: 112.2, latitude: 35.2 },
  sui: { year: 600, placeName: '隋代文化区域', longitude: 110.1, latitude: 34.3 },
  tang: { year: 750, placeName: '唐代诗歌文化区域', longitude: 109.2, latitude: 34.2 },
  'five-dynasties': { year: 940, placeName: '五代词文化区域', longitude: 118.8, latitude: 32.1 },
  song: { year: 1120, placeName: '宋代诗词文化区域', longitude: 116.3, latitude: 30.7 },
  yuan: { year: 1320, placeName: '元代诗曲文化区域', longitude: 116.4, latitude: 35.4 },
  ming: { year: 1510, placeName: '明代诗歌文化区域', longitude: 118.8, latitude: 32.1 },
  qing: { year: 1780, placeName: '清代诗歌文化区域', longitude: 116.8, latitude: 34.5 },
}

const authorProfiles: Record<string, Partial<PlaceProfile>> = {
  李白: { year: 752, placeName: '李白主要行旅区域', longitude: 111.3, latitude: 30.7 },
  杜甫: { year: 760, placeName: '成都 · 杜甫草堂', longitude: 104.03, latitude: 30.66 },
  王维: { year: 740, placeName: '蓝田 · 辋川', longitude: 109.36, latitude: 34.02 },
  白居易: { year: 815, placeName: '洛阳', longitude: 112.45, latitude: 34.62 },
  孟浩然: { year: 730, placeName: '襄阳', longitude: 112.12, latitude: 32.01 },
  刘禹锡: { year: 824, placeName: '洛阳', longitude: 112.45, latitude: 34.62 },
  杜牧: { year: 845, placeName: '江南行旅区域', longitude: 118.78, latitude: 32.04 },
  王昌龄: { year: 740, placeName: '长安及西北行旅区域', longitude: 108.94, latitude: 34.34 },
  李商隐: { year: 850, placeName: '晚唐中原行旅区域', longitude: 112.45, latitude: 34.62 },
  韩愈: { year: 815, placeName: '唐代中原行旅区域', longitude: 112.45, latitude: 34.62 },
  岑参: { year: 755, placeName: '西北边塞行旅区域', longitude: 94.66, latitude: 40.14 },
  苏轼: { year: 1082, placeName: '黄州 · 东坡', longitude: 114.87, latitude: 30.44 },
  王安石: { year: 1070, placeName: '江宁 · 钟山', longitude: 118.84, latitude: 32.06 },
  杨万里: { year: 1180, placeName: '吉州 · 吉水', longitude: 115.14, latitude: 27.21 },
  陆游: { year: 1185, placeName: '山阴 · 绍兴', longitude: 120.58, latitude: 30.0 },
  辛弃疾: { year: 1180, placeName: '信州 · 上饶', longitude: 117.97, latitude: 28.45 },
  李清照: { year: 1125, placeName: '宋代齐鲁江南行旅区域', longitude: 117.12, latitude: 36.65 },
  朱熹: { year: 1175, placeName: '武夷山', longitude: 117.97, latitude: 27.65 },
  范成大: { year: 1175, placeName: '苏州 · 石湖', longitude: 120.58, latitude: 31.25 },
  欧阳修: { year: 1050, placeName: '北宋江淮活动区域', longitude: 117.28, latitude: 31.86 },
  陶渊明: { year: 410, placeName: '柴桑 · 庐山南麓', longitude: 115.88, latitude: 29.46 },
  曹操: { year: 208, placeName: '建安中原行旅区域', longitude: 114.45, latitude: 36.58 },
  龚自珍: { year: 1839, placeName: '清代京杭行旅区域', longitude: 116.4, latitude: 39.9 },
  纳兰性德: { year: 1680, placeName: '清代京畿', longitude: 116.4, latitude: 39.9 },
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

function coordinateOffset(hash: number, shift: number) {
  return (((hash >>> shift) % 17) - 8) * 0.24
}

export function schoolPoemTextKey(poem: Pick<Poem, 'lines'>) {
  return poem.lines.join('').replace(/[\s，。！？；、：：“”‘’（）()《》·,.!?;:'"-]/gu, '')
}

export const schoolPoems: Poem[] = schoolPoemSeeds.map((seed) => {
  const dynastyProfile = dynastyProfiles[seed.dynasty]
  const profile = { ...dynastyProfile, ...authorProfiles[seed.author] }
  const hash = stableHash(seed.sourceId)
  const effect = effects[hash % effects.length]
  const year = profile.year

  return {
    id: `school-${seed.sourceId}`,
    title: seed.title,
    author: seed.author,
    dynasty: seed.dynasty,
    year,
    yearLabel: dynastyYearLabels[seed.dynasty],
    eraLabel: dynastyEraLabels[seed.dynasty],
    lines: seed.lines,
    longitude: profile.longitude + coordinateOffset(hash, 4),
    latitude: profile.latitude + coordinateOffset(hash, 12),
    placeId: `school-place-${seed.sourceId}`,
    placeName: profile.placeName,
    relation: 'associated',
    confidence: 'low',
    evidence: `教材篇目未提供可核定的创作地点；以${profile.placeName}作为低置信度阅读锚点，地图偏移仅用于避免作品重叠。`,
    sourceLabel: '统编语文古诗词篇目 · 公开古籍校订',
    sourceUrl: `https://www.gushiwen.cn/shiwenv_${seed.sourceId}.aspx`,
    accent: effect.accent,
    visualEffect: effect.id,
    visualEffectLabel: effect.label,
    curriculumLevels: seed.curriculumLevels,
  }
})
