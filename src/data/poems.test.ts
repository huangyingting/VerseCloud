import { describe, expect, it } from 'vitest'
import { snapshots } from './mapSnapshots'
import { defaultPoem, poems } from './poems'

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

    expect(poems.length).toBeGreaterThanOrEqual(38)
    counts.forEach((count) => expect(count).toBeGreaterThanOrEqual(3))
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
