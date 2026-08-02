import { describe, expect, it } from 'vitest'
import { snapshots } from './mapSnapshots'
import { defaultPoem, poems } from './poems'
import { schoolPoems, schoolPoemTextKey } from './schoolPoems'
import { schoolPoemSeeds } from './schoolPoems.generated'
import { schoolPoemPlaceCorrections } from './schoolPoemPlaces'

describe('curated poem corpus', () => {
  it('publishes every literary period with multiple browsable works', () => {
    expect(snapshots).toHaveLength(11)
    expect(snapshots.every((snapshot) => snapshot.status === 'published')).toBe(true)

    const counts = new Map(
      snapshots.map((snapshot) => [
        snapshot.dynasty,
        poems.filter((poem) => poem.dynasty === snapshot.dynasty).length,
      ]),
    )

    expect(poems.length).toBeGreaterThanOrEqual(210)
    counts.forEach((count) => expect(count).toBeGreaterThanOrEqual(3))
  })

  it('publishes the unified primary and middle-school classical verse corpus', () => {
    expect(schoolPoemSeeds).toHaveLength(194)
    expect(schoolPoemSeeds.filter((poem) =>
      poem.curriculumLevels.includes('primary'))).toHaveLength(110)
    expect(schoolPoemSeeds.filter((poem) =>
      poem.curriculumLevels.includes('middle'))).toHaveLength(84)

    const publishedByText = new Map(
      poems.map((poem) => [schoolPoemTextKey(poem), poem]),
    )
    schoolPoems.forEach((schoolPoem) => {
      const published = publishedByText.get(schoolPoemTextKey(schoolPoem))
      expect(published, schoolPoem.title).toBeDefined()
      expect(published?.curriculumLevels).toEqual(schoolPoem.curriculumLevels)
      expect.soft(published?.placeId, `${schoolPoem.title} placeId`).toBe(schoolPoem.placeId)
      expect.soft(published?.placeName, `${schoolPoem.title} placeName`).toBe(schoolPoem.placeName)
      expect.soft(published?.longitude, `${schoolPoem.title} longitude`).toBe(schoolPoem.longitude)
      expect.soft(published?.latitude, `${schoolPoem.title} latitude`).toBe(schoolPoem.latitude)
      expect.soft(published?.relation, `${schoolPoem.title} relation`).toBe(schoolPoem.relation)
      expect.soft(published?.confidence, `${schoolPoem.title} confidence`).toBe(schoolPoem.confidence)
      expect.soft(published?.evidence, `${schoolPoem.title} evidence`).toBe(schoolPoem.evidence)
    })
    expect(poems.filter((poem) => poem.curriculumLevels)).toHaveLength(194)
  })

  it('requires one explicit, independently evidenced place correction per school poem', () => {
    const seedIds = schoolPoemSeeds.map((poem) => poem.sourceId).sort()
    const correctionIds = Object.keys(schoolPoemPlaceCorrections).sort()
    const corrections = Object.values(schoolPoemPlaceCorrections)

    expect(correctionIds).toEqual(seedIds)
    expect(corrections).toHaveLength(194)
    expect(new Set(corrections.map((correction) => correction.evidence)).size).toBe(194)

    corrections.forEach((correction) => {
      expect(correction.placeId).toMatch(/^[a-z0-9-]+$/)
      expect(correction.placeId).not.toMatch(/^school-place-/)
      expect(correction.placeName.trim().length).toBeGreaterThan(0)
      expect(correction.evidence.length).toBeGreaterThanOrEqual(24)
      expect(correction.evidence).not.toMatch(/文化区域|行旅区域|活动区域|诗歌文化区域|地图偏移|避免作品重叠/u)
      expect(correction.longitude).toBeGreaterThanOrEqual(68)
      expect(correction.longitude).toBeLessThanOrEqual(131)
      expect(correction.latitude).toBeGreaterThanOrEqual(16)
      expect(correction.latitude).toBeLessThanOrEqual(53)
    })
  })

  it('publishes only concrete place labels and keeps shared place coordinates consistent', () => {
    const forbiddenGenericNames = /文化区域|行旅区域|活动区域|诗歌文化区域|江南水乡|江南羁旅|江南驿路|行旅想象|云南 · 戍所/u
    const places = new Map<string, Pick<(typeof poems)[number], 'placeName' | 'longitude' | 'latitude'>>()

    expect(new Set(poems.map((poem) => poem.evidence)).size).toBe(poems.length)

    poems.forEach((poem) => {
      expect(poem.placeName).not.toMatch(forbiddenGenericNames)
      expect(poem.evidence).not.toMatch(/地图偏移|避免作品重叠/u)

      const existing = places.get(poem.placeId)
      if (existing) {
        expect(poem.placeName, poem.placeId).toBe(existing.placeName)
        expect(poem.longitude, poem.placeId).toBe(existing.longitude)
        expect(poem.latitude, poem.placeId).toBe(existing.latitude)
      } else {
        places.set(poem.placeId, poem)
      }
    })
  })

  it('keeps ids, text, map coordinates, evidence, and sources production-safe', () => {
    expect(new Set(poems.map((poem) => poem.id)).size).toBe(poems.length)
    expect(poems).toContain(defaultPoem)

    poems.forEach((poem) => {
      expect(poem.id).toMatch(/^[a-z0-9-]+$/)
      expect(poem.title.trim().length).toBeGreaterThan(0)
      expect(poem.author.trim().length).toBeGreaterThan(0)
      expect(poem.lines.length).toBeGreaterThan(0)
      expect(poem.lines.every((line) => line.trim().length > 0)).toBe(true)
      expect(poem.longitude).toBeGreaterThanOrEqual(68)
      expect(poem.longitude).toBeLessThanOrEqual(131)
      expect(poem.latitude).toBeGreaterThanOrEqual(16)
      expect(poem.latitude).toBeLessThanOrEqual(53)
      expect(poem.evidence.length).toBeGreaterThanOrEqual(18)
      expect(poem.sourceLabel.length).toBeGreaterThan(0)
      expect(poem.sourceUrl).toMatch(/^https:\/\//)
      expect(poem.accent).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('keeps dated works inside their declared period boundaries', () => {
    snapshots.forEach((snapshot) => {
      poems
        .filter((poem) => poem.dynasty === snapshot.dynasty)
        .forEach((poem) => {
          expect(poem.year).toBeGreaterThanOrEqual(snapshot.startYear)
          // Literary periods overlap political transitions by a few years;
          // the Five Dynasties corpus includes Li Yu's post-conquest works.
          const graceYears = snapshot.dynasty === 'five-dynasties' ? 20 : 0
          expect(poem.year).toBeLessThanOrEqual(snapshot.endYear + graceYears)
        })
    })
  })
})
