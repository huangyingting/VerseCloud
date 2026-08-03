import { describe, expect, it } from 'vitest'
import { snapshots } from './mapSnapshots'
import {
  historicalDivisionCollection,
  historicalMapContexts,
} from './historicalGeography'

describe('historical administrative map contexts', () => {
  it('publishes a region, seat, and division layer for every literary period', () => {
    expect(Object.keys(historicalMapContexts)).toEqual(
      snapshots.map((snapshot) => snapshot.dynasty),
    )

    snapshots.forEach((snapshot) => {
      const context = historicalMapContexts[snapshot.dynasty]
      const regions = context.labels.filter((label) => label.kind === 'region')
      const seats = context.labels.filter((label) => label.kind === 'prefecture')

      expect(context.systemLabel, snapshot.dynasty).not.toBe('')
      expect(context.referenceLabel, snapshot.dynasty).not.toBe('')
      expect(regions.length, snapshot.dynasty).toBeGreaterThanOrEqual(7)
      expect(seats.length, snapshot.dynasty).toBeGreaterThanOrEqual(4)
      expect(context.divisionLines.length, snapshot.dynasty).toBeGreaterThanOrEqual(7)
    })
  })

  it('keeps every conceptual label and division inside the supported map extent', () => {
    Object.values(historicalMapContexts).forEach((context) => {
      const labelKeys = context.labels.map((label) => `${label.kind}:${label.name}`)
      expect(new Set(labelKeys).size, context.dynasty).toBe(labelKeys.length)

      context.labels.forEach((label) => {
        expect(label.longitude, `${context.dynasty}/${label.name}`).toBeGreaterThanOrEqual(68)
        expect(label.longitude, `${context.dynasty}/${label.name}`).toBeLessThanOrEqual(131)
        expect(label.latitude, `${context.dynasty}/${label.name}`).toBeGreaterThanOrEqual(16)
        expect(label.latitude, `${context.dynasty}/${label.name}`).toBeLessThanOrEqual(53)
      })

      context.divisionLines.forEach((line, lineIndex) => {
        expect(line.length, `${context.dynasty}/line-${lineIndex}`).toBeGreaterThanOrEqual(2)
        line.forEach(([longitude, latitude]) => {
          expect(Number.isFinite(longitude)).toBe(true)
          expect(Number.isFinite(latitude)).toBe(true)
          expect(longitude).toBeGreaterThanOrEqual(68)
          expect(longitude).toBeLessThanOrEqual(131)
          expect(latitude).toBeGreaterThanOrEqual(16)
          expect(latitude).toBeLessThanOrEqual(53)
        })
      })

      const collection = historicalDivisionCollection(context)
      expect(collection.features).toHaveLength(1)
      expect(collection.features[0].properties).toMatchObject({
        dynasty: context.dynasty,
        system: context.systemLabel,
        interpretation: 'artistic',
      })
    })
  })
})
