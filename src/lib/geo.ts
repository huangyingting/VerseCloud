import { geoMercator } from 'd3-geo'
import * as THREE from 'three'
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

function normalizedRing(ring: number[][], clockwise: boolean) {
  const points = ring.map(([longitude, latitude]) => {
    const { x, y } = projectPoint(longitude, latitude)
    return new THREE.Vector2(x, y)
  })

  if (points.length > 1 && points[0].equals(points[points.length - 1])) {
    points.pop()
  }

  if (THREE.ShapeUtils.isClockWise(points) !== clockwise) points.reverse()
  return points
}

export function polygonCoordinatesToShape(polygon: number[][][]): THREE.Shape | null {
  if (!polygon[0] || polygon[0].length < 4) return null
  const shape = new THREE.Shape(normalizedRing(polygon[0], true))

  for (const hole of polygon.slice(1)) {
    if (hole.length >= 4) {
      shape.holes.push(new THREE.Path(normalizedRing(hole, false)))
    }
  }

  return shape
}

export function geometryToShapes(geometry: {
  type: string
  coordinates: unknown
}): THREE.Shape[] {
  if (geometry.type === 'Polygon') {
    const shape = polygonCoordinatesToShape(geometry.coordinates as number[][][])
    return shape ? [shape] : []
  }

  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][])
      .map(polygonCoordinatesToShape)
      .filter((shape): shape is THREE.Shape => shape !== null)
  }

  return []
}

export function lineToScenePoints(line: number[][], z = 0.12) {
  return line.map(([longitude, latitude]) => {
    const { x, y } = projectPoint(longitude, latitude)
    return new THREE.Vector3(x, y, z)
  })
}
