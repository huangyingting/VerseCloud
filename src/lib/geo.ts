import { geoMercator } from 'd3-geo'
import type { ScenePoint } from '../types'

const projection = geoMercator()
  .center([103, 35])
  .scale(13.5)
  .translate([0, 0])

export function projectPoint(longitude: number, latitude: number): ScenePoint {
  const point = projection([longitude, latitude])
  if (!point) return { x: 0, y: 0 }
  return { x: point[0], y: -point[1] }
}
