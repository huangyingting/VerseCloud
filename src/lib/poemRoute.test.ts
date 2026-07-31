import { describe, expect, it } from 'vitest'
import { poems } from '../data/poems'
import { poemRoute } from './poemRoute'

describe('poemRoute', () => {
  it('builds a gently curved route with exact poem endpoints', () => {
    const from = poems[0]
    const to = poems[2]
    const route = poemRoute(from, to)
    const coordinates = route.features[0]?.geometry.coordinates

    expect(route.features[0]?.properties).toEqual({ from: from.id, to: to.id })
    expect(coordinates).toHaveLength(33)
    expect(coordinates?.[0]).toEqual([from.longitude, from.latitude])
    expect(coordinates?.at(-1)).toEqual([to.longitude, to.latitude])
    expect(coordinates?.[16]).not.toEqual([
      (from.longitude + to.longitude) / 2,
      (from.latitude + to.latitude) / 2,
    ])
  })

  it('does not invent a route between poems at the same coordinates', () => {
    const from = poems[0]
    const samePlace = { ...poems[1], longitude: from.longitude, latitude: from.latitude }

    expect(poemRoute(from, samePlace).features).toEqual([])
  })
})
