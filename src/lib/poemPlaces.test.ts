import { describe, expect, it } from 'vitest'
import { poems } from '../data/poems'
import { elevateNearbyPoemPlaces, groupPoemsByPlace } from './poemPlaces'

describe('groupPoemsByPlace', () => {
  it('stacks poems assigned to one site without merging neighbouring places', () => {
    const duplicate = {
      ...poems[0],
      id: 'another-changan-poem',
      title: '长安新诗',
    }
    const nearby = {
      ...poems[0],
      id: 'nearby-place-poem',
      placeId: 'nearby-place',
      longitude: poems[0].longitude + 0.001,
    }

    const groups = groupPoemsByPlace([poems[0], duplicate, nearby])

    expect(groups).toHaveLength(2)
    expect(groups[0].poems.map((poem) => poem.id)).toEqual([
      poems[0].id,
      duplicate.id,
    ])
    expect(groups[1].poems).toHaveLength(1)
  })

  it('assigns different stable heights to nearby places', () => {
    const layouts = elevateNearbyPoemPlaces(poems)
    const byKey = new Map(layouts.map((place) => [place.key, place]))
    const changan = byKey.get('changan')
    const weicheng = byKey.get('weicheng')
    const guanquelou = byKey.get('pu-guanquelou')
    const distant = byKey.get('gusu-fengqiao')

    expect(changan?.hasNearbyPlace).toBe(true)
    expect(weicheng?.hasNearbyPlace).toBe(true)
    expect(guanquelou?.hasNearbyPlace).toBe(true)
    expect(new Set([
      changan?.liftTier,
      weicheng?.liftTier,
      guanquelou?.liftTier,
    ]).size).toBe(3)
    expect(distant).toMatchObject({ liftTier: 0, hasNearbyPlace: false })
  })
})
