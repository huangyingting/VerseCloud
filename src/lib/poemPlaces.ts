import type { Poem } from '../types'

export interface PoemPlaceGroup {
  key: string
  longitude: number
  latitude: number
  placeName: string
  poems: Poem[]
}

export function groupPoemsByPlace(poems: Poem[]): PoemPlaceGroup[] {
  const groups = new Map<string, PoemPlaceGroup>()
  poems.forEach((poem) => {
    // A stable editorial place ID is more reliable than fuzzy coordinates:
    // multiple records at one site stack even if their geocoding differs,
    // while neighbouring historical places remain independently selectable.
    const key = poem.placeId
    const group = groups.get(key)
    if (group) {
      group.poems.push(poem)
      return
    }
    groups.set(key, {
      key,
      longitude: poem.longitude,
      latitude: poem.latitude,
      placeName: poem.placeName,
      poems: [poem],
    })
  })
  return [...groups.values()]
}
