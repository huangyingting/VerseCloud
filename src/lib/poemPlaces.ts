import type { Poem } from '../types'

export interface PoemPlaceGroup {
  key: string
  longitude: number
  latitude: number
  placeName: string
  poems: Poem[]
}

export interface ElevatedPoemPlaceGroup extends PoemPlaceGroup {
  liftTier: number
  hasNearbyPlace: boolean
}

// At the map's overview zoom, places within roughly 170 km can visually
// overlap. Assigning fixed tiers once keeps close markers distinct without
// making them jump between heights while the camera is moving.
export const nearbyPoemPlaceDistanceKm = 170

function distanceInKilometres(a: PoemPlaceGroup, b: PoemPlaceGroup) {
  const toRadians = Math.PI / 180
  const latitudeDelta = (b.latitude - a.latitude) * toRadians
  const longitudeDelta = (b.longitude - a.longitude) * toRadians
  const aLatitude = a.latitude * toRadians
  const bLatitude = b.latitude * toRadians
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2
  const boundedHaversine = Math.min(1, Math.max(0, haversine))
  return 6_371 * 2 * Math.atan2(
    Math.sqrt(boundedHaversine),
    Math.sqrt(1 - boundedHaversine),
  )
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

export function elevateNearbyPoemPlaces(
  poems: Poem[],
  nearbyDistanceKm = nearbyPoemPlaceDistanceKm,
): ElevatedPoemPlaceGroup[] {
  const groups = groupPoemsByPlace(poems)
  const neighbours = groups.map((group, groupIndex) =>
    groups.map((candidate, candidateIndex) => (
      groupIndex !== candidateIndex
      && distanceInKilometres(group, candidate) <= nearbyDistanceKm
    )),
  )
  const elevated: ElevatedPoemPlaceGroup[] = []

  groups.forEach((group, groupIndex) => {
    const occupiedTiers = new Set<number>()
    for (let candidateIndex = 0; candidateIndex < groupIndex; candidateIndex += 1) {
      if (neighbours[groupIndex][candidateIndex]) {
        occupiedTiers.add(elevated[candidateIndex].liftTier)
      }
    }
    let liftTier = 0
    while (occupiedTiers.has(liftTier)) liftTier += 1
    const elevatedGroup: ElevatedPoemPlaceGroup = {
      ...group,
      liftTier,
      hasNearbyPlace: neighbours[groupIndex].some(Boolean),
    }
    elevated.push(elevatedGroup)
  })

  return elevated
}
