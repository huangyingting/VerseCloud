import type { Poem } from '../types'

export function emptyPoemRoute(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return { type: 'FeatureCollection', features: [] }
}

export function poemRoute(
  from: Poem,
  to: Poem,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const longitudeDelta = to.longitude - from.longitude
  const latitudeDelta = to.latitude - from.latitude
  const distance = Math.hypot(longitudeDelta, latitudeDelta)
  if (distance < 0.01) return emptyPoemRoute()

  const middleLongitude = (from.longitude + to.longitude) / 2
  const middleLatitude = (from.latitude + to.latitude) / 2
  const bend = Math.min(2.2, Math.max(0.32, distance * 0.13))
  const controlLongitude = middleLongitude - (latitudeDelta / distance) * bend
  const controlLatitude = middleLatitude + (longitudeDelta / distance) * bend
  const coordinates = Array.from({ length: 33 }, (_, index) => {
    const progress = index / 32
    const inverse = 1 - progress
    return [
      inverse * inverse * from.longitude
        + 2 * inverse * progress * controlLongitude
        + progress * progress * to.longitude,
      inverse * inverse * from.latitude
        + 2 * inverse * progress * controlLatitude
        + progress * progress * to.latitude,
    ]
  })

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { from: from.id, to: to.id },
      geometry: { type: 'LineString', coordinates },
    }],
  }
}
