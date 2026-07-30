import { describe, expect, it } from 'vitest'
import { poems } from '../data/poems'
import { groupPoemsByPlace } from './poemPlaces'

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
})
