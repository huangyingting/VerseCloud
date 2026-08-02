import {
  LngLat,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { dynastyLabels } from '../data/mapSnapshots'
import { tangMapLabels, tangRegionDivisions } from '../data/tangGeography'
import { projectPoint } from '../lib/geo'
import { elevateNearbyPoemPlaces } from '../lib/poemPlaces'
import { emptyPoemRoute, poemRoute } from '../lib/poemRoute'
import type { Poem, ScenePoint, Season } from '../types'

interface VerseSceneProps {
  poems: Poem[]
  selectedPoem: Poem
  season: Season
  onSelectPoem: (poem: Poem) => void
  onFocusChange: (point: ScenePoint) => void
}

type LineLayerSpecification = Extract<StyleSpecification['layers'][number], { type: 'line' }>
type LineGradientSpecification = NonNullable<
  NonNullable<LineLayerSpecification['paint']>['line-gradient']
>

// Vite does not discover MapLibre's import.meta.url worker when the library is
// loaded lazily. Importing it as an asset makes the production URL explicit.
setWorkerUrl(mapWorkerUrl)

const classicalChinaBounds: [[number, number], [number, number]] = [
  [68, 16],
  [131, 53],
]

const geographicStyle: StyleSpecification = {
  version: 8,
  name: 'VerseCloud geographic relief',
  sources: {
    shadedRelief: {
      type: 'raster',
      tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 6,
      bounds: [69, 18, 129, 51],
      attribution: 'Natural Earth · OpenFreeMap',
    },
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenFreeMap · © OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'night-paper',
      type: 'background',
      paint: { 'background-color': '#09130f' },
    },
    {
      id: 'earth-relief',
      type: 'raster',
      source: 'shadedRelief',
      paint: {
        'raster-opacity': 0.86,
        'raster-saturation': -0.48,
        'raster-contrast': 0.28,
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.46,
        'raster-hue-rotate': 18,
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          'ocean', '#071f25',
          'lake', '#123239',
          'river', '#1a4143',
          '#0d2c31',
        ],
        'fill-opacity': 0.9,
      },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: ['in', 'class', 'river', 'canal'],
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          'canal', '#a4bba3',
          '#73aaa5',
        ],
        'line-opacity': 0.4,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 7, 1.8],
      },
    },
  ],
  sky: {
    'sky-color': '#07110d',
    'horizon-color': '#2d3b32',
    'fog-color': '#101d17',
    'sky-horizon-blend': 0.72,
    'horizon-fog-blend': 0.42,
    'fog-ground-blend': 0.6,
    'atmosphere-blend': 0.5,
  },
}

const seasonPalettes: Record<Season, {
  background: string
  reliefHue: number
  reliefSaturation: number
  reliefBrightness: number
  division: string
  ocean: string
  lake: string
  river: string
  water: string
}> = {
  spring: {
    background: '#0a1712', reliefHue: 12, reliefSaturation: -0.34, reliefBrightness: 0.5,
    division: '#c5af7d',
    ocean: '#08232a', lake: '#14373b', river: '#2f6360', water: '#103137',
  },
  summer: {
    background: '#071711', reliefHue: 32, reliefSaturation: -0.2, reliefBrightness: 0.45,
    division: '#a9b77a',
    ocean: '#06262c', lake: '#0d3b3d', river: '#326e67', water: '#0b3336',
  },
  autumn: {
    background: '#17140d', reliefHue: 338, reliefSaturation: -0.28, reliefBrightness: 0.48,
    division: '#d0a46c',
    ocean: '#10242a', lake: '#29353a', river: '#657b73', water: '#1b3034',
  },
  winter: {
    background: '#0b1418', reliefHue: 188, reliefSaturation: -0.62, reliefBrightness: 0.56,
    division: '#b5c0b8',
    ocean: '#071d29', lake: '#17313d', river: '#6f9298', water: '#102936',
  },
}

function applySeasonPalette(map: MapLibreMap, season: Season) {
  const palette = seasonPalettes[season]
  map.setPaintProperty('night-paper', 'background-color', palette.background)
  map.setPaintProperty('earth-relief', 'raster-hue-rotate', palette.reliefHue)
  map.setPaintProperty('earth-relief', 'raster-saturation', palette.reliefSaturation)
  map.setPaintProperty('earth-relief', 'raster-brightness-max', palette.reliefBrightness)
  map.setPaintProperty('water', 'fill-color', [
    'match',
    ['get', 'class'],
    'ocean', palette.ocean,
    'lake', palette.lake,
    'river', palette.river,
    palette.water,
  ])
  if (map.getLayer('tang-region-line')) {
    map.setPaintProperty('tang-region-line', 'line-color', palette.division)
  }
}

function historicalLabelCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: tangMapLabels.map((label, index) => ({
      type: 'Feature',
      id: index,
      properties: {
        imageId: `tang-label-${index}`,
        kind: label.kind,
        major: Boolean(label.major),
      },
      geometry: {
        type: 'Point',
        coordinates: [label.longitude, label.latitude],
      },
    })),
  }
}

function createLabelImage(name: string, kind: 'region' | 'prefecture') {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const fontSize = kind === 'region' ? 13 : 12
  const letterSpacing = kind === 'region' ? 3 : 1.5
  const paddingX = kind === 'region' ? 7 : 5
  const dotWidth = kind === 'prefecture' ? 8 : 0
  const measureCanvas = document.createElement('canvas')
  const measure = measureCanvas.getContext('2d')
  if (!measure) return null
  measure.font = `${fontSize}px "Zhuque Fangsong (technical preview)", FangSong, serif`
  const textWidth = measure.measureText(name).width + Math.max(0, name.length - 1) * letterSpacing
  const width = Math.ceil(textWidth + paddingX * 2 + dotWidth)
  const height = kind === 'region' ? 24 : 21
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(pixelRatio, pixelRatio)
  context.font = `${fontSize}px "Zhuque Fangsong (technical preview)", FangSong, serif`
  context.textBaseline = 'middle'
  context.shadowColor = 'rgba(2, 8, 6, 0.95)'
  context.shadowBlur = 4

  if (kind === 'region') {
    context.fillStyle = 'rgba(7, 15, 12, 0.36)'
    context.fillRect(0.5, 0.5, width - 1, height - 1)
    context.strokeStyle = 'rgba(206, 183, 128, 0.18)'
    context.strokeRect(0.5, 0.5, width - 1, height - 1)
    context.fillStyle = 'rgba(218, 196, 147, 0.78)'
  } else {
    context.fillStyle = 'rgba(203, 174, 105, 0.9)'
    context.beginPath()
    context.arc(4, height / 2, 2, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = 'rgba(238, 226, 197, 0.88)'
  }

  let x = paddingX + dotWidth
  for (const character of name) {
    context.fillText(character, x, height / 2 + 0.5)
    x += context.measureText(character).width + letterSpacing
  }
  return { image: context.getImageData(0, 0, canvas.width, canvas.height), pixelRatio }
}

const poemMarkerHeadCenterY = 12

function poemMarkerHeight(liftTier: number) {
  return 36 + Math.max(0, liftTier) * 28
}

function createPoemLabelImage(name: string) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const fontSize = 15
  const letterSpacing = 1
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return null
  context.font = `${fontSize}px "Zhuque Fangsong (technical preview)", FangSong, serif`
  const textWidth = context.measureText(name).width + Math.max(0, name.length - 1) * letterSpacing
  const width = Math.ceil(textWidth + 14)
  const height = 28
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)
  const paint = canvas.getContext('2d')
  if (!paint) return null
  paint.scale(pixelRatio, pixelRatio)
  paint.font = `${fontSize}px "Zhuque Fangsong (technical preview)", FangSong, serif`
  paint.textBaseline = 'middle'
  paint.fillStyle = '#f3e5c5'
  paint.shadowColor = 'rgba(2, 8, 6, 0.98)'
  paint.shadowBlur = 5
  let x = 7
  for (const character of name) {
    paint.fillText(character, x, height / 2)
    x += paint.measureText(character).width + letterSpacing
  }
  return { image: paint.getImageData(0, 0, canvas.width, canvas.height), pixelRatio }
}

function createPoemCountImage(count: number) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const size = 22
  const canvas = document.createElement('canvas')
  canvas.width = size * pixelRatio
  canvas.height = size * pixelRatio
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(pixelRatio, pixelRatio)
  context.font = '600 10px "Zhuque Fangsong (technical preview)", FangSong, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = 'rgba(2, 7, 5, 0.9)'
  context.shadowBlur = 2
  context.fillStyle = '#f3dfb1'
  context.fillText(String(count), size / 2, size / 2 - 1)
  return { image: context.getImageData(0, 0, canvas.width, canvas.height), pixelRatio }
}

function createPoemMarkerImage(liftTier: number, selected: boolean) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const width = 40
  const height = poemMarkerHeight(liftTier)
  const canvas = document.createElement('canvas')
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(pixelRatio, pixelRatio)

  const centerX = width / 2
  const headWidth = selected ? 16 : 14
  const headHeight = selected ? 22 : 20
  const headX = centerX - headWidth / 2
  const headY = poemMarkerHeadCenterY - headHeight / 2
  const baseY = height - 3

  context.lineCap = 'round'
  context.strokeStyle = 'rgba(1, 5, 3, 0.72)'
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(centerX + 1, headY + headHeight - 1)
  context.lineTo(centerX + 1, baseY - 3)
  context.stroke()

  const stem = context.createLinearGradient(centerX, headY, centerX, baseY)
  stem.addColorStop(0, selected ? '#f1d49a' : '#c8b27f')
  stem.addColorStop(1, selected ? '#8f6540' : '#5f604f')
  context.strokeStyle = stem
  context.lineWidth = selected ? 1.8 : 1.2
  context.beginPath()
  context.moveTo(centerX, headY + headHeight - 1)
  context.lineTo(centerX, baseY - 3)
  context.stroke()

  context.strokeStyle = selected ? '#d4a866' : 'rgba(183, 169, 126, 0.72)'
  context.lineWidth = selected ? 1.8 : 1.2
  context.beginPath()
  context.moveTo(centerX - 6, baseY - 3)
  context.lineTo(centerX, baseY)
  context.lineTo(centerX + 6, baseY - 3)
  context.stroke()

  const corner = 3
  context.beginPath()
  context.moveTo(headX + corner, headY)
  context.lineTo(headX + headWidth - corner, headY)
  context.lineTo(headX + headWidth, headY + corner)
  context.lineTo(headX + headWidth, headY + headHeight - corner)
  context.lineTo(headX + headWidth - corner, headY + headHeight)
  context.lineTo(headX + corner, headY + headHeight)
  context.lineTo(headX, headY + headHeight - corner)
  context.lineTo(headX, headY + corner)
  context.closePath()
  context.fillStyle = selected ? 'rgba(139, 65, 48, 0.96)' : 'rgba(16, 29, 24, 0.9)'
  context.strokeStyle = selected ? '#f0d59c' : 'rgba(220, 202, 158, 0.9)'
  context.lineWidth = selected ? 1.8 : 1.25
  context.fill()
  context.stroke()

  context.strokeStyle = selected ? '#f9e7ba' : 'rgba(208, 190, 148, 0.72)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(centerX - 3, poemMarkerHeadCenterY - 3)
  context.lineTo(centerX + 3, poemMarkerHeadCenterY - 3)
  context.moveTo(centerX - 3, poemMarkerHeadCenterY + 1)
  context.lineTo(centerX + 3, poemMarkerHeadCenterY + 1)
  context.stroke()

  context.fillStyle = selected ? '#f7dfab' : '#baaa80'
  context.beginPath()
  context.arc(centerX, poemMarkerHeadCenterY + 6, 1.1, 0, Math.PI * 2)
  context.fill()

  return { image: context.getImageData(0, 0, canvas.width, canvas.height), pixelRatio }
}

function routeInkGradient(progress: number): LineGradientSpecification {
  return [
    'case',
    ['<=', ['line-progress'], progress],
    'rgba(205, 184, 132, 0.58)',
    'rgba(205, 184, 132, 0)',
  ] as LineGradientSpecification
}

function routeFlowGradient(progress: number): LineGradientSpecification {
  const head = Math.min(0.985, Math.max(0.015, progress))
  const tail = Math.max(0, head - 0.2)
  const shoulder = Math.max(tail + 0.001, head - 0.055)
  return [
    'interpolate', ['linear'], ['line-progress'],
    tail, 'rgba(217, 181, 100, 0)',
    shoulder, 'rgba(222, 188, 111, 0.5)',
    head, 'rgba(255, 239, 190, 1)',
    head + 0.025, 'rgba(255, 239, 190, 0)',
  ] as LineGradientSpecification
}

const transparentRouteGradient = [
  'case',
  ['>=', ['line-progress'], 0],
  'rgba(255, 239, 190, 0)',
  'rgba(255, 239, 190, 0)',
] as LineGradientSpecification

function poemCollection(poems: Poem[], selectedPoemId?: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const groups = elevateNearbyPoemPlaces(poems)
  return {
    type: 'FeatureCollection',
    features: groups.map((group, index) => {
      const selected = group.poems.some((poem) => poem.id === selectedPoemId)
      const representative = group.poems.find((poem) => poem.id === selectedPoemId) ?? group.poems[0]
      return {
        type: 'Feature',
        id: group.key,
        properties: {
          id: representative.id,
          title: representative.title,
          author: representative.author,
          placeName: group.placeName,
          accent: representative.accent,
          imageId: `poem-label-${index}`,
          markerImageId: `poem-marker-${group.liftTier}-${selected ? 'selected' : 'idle'}`,
          countImageId: `poem-count-${group.poems.length}`,
          labelOffset: [0, -poemMarkerHeight(group.liftTier) - 4],
          countOffset: [0, -poemMarkerHeight(group.liftTier) + 23],
          memberIds: JSON.stringify(group.poems.map((poem) => poem.id)),
          count: group.poems.length,
          liftTier: group.liftTier,
          hasNearbyPlace: group.hasNearbyPlace,
          selected,
          priority: selected
            ? 0
            : (index < 12 || representative.id === 'cui-hao-huanghelou' ? 1 : 2),
        },
        geometry: {
          type: 'Point',
          coordinates: [group.longitude, group.latitude],
        },
      }
    }),
  }
}

function addHistoricalLayers(
  map: MapLibreMap,
  poems: Poem[],
  selectedPoemId: string,
  showTangContext: boolean,
) {
  if (showTangContext) {
    map.addSource('tang-regions', {
      type: 'geojson',
      data: tangRegionDivisions,
    })
    map.addLayer({
      id: 'tang-region-line',
      type: 'line',
      source: 'tang-regions',
      paint: {
        'line-color': '#c5af7d',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.28, 6, 0.5],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 6, 1.15],
        'line-dasharray': [1.2, 2.4],
      },
    })
  }

  map.addSource('poem-route', {
    type: 'geojson',
    data: emptyPoemRoute(),
    lineMetrics: true,
  })
  map.addLayer({
    id: 'poem-route-shadow',
    type: 'line',
    source: 'poem-route',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#07100d',
      'line-opacity': 0.46,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3.2, 7, 5.4],
      'line-blur': 1.2,
    },
  })
  map.addLayer({
    id: 'poem-route-ink',
    type: 'line',
    source: 'poem-route',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-gradient': routeInkGradient(0),
      'line-opacity': 0.74,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.1, 7, 1.8],
    },
  })
  map.addLayer({
    id: 'poem-route-flow',
    type: 'line',
    source: 'poem-route',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-gradient': transparentRouteGradient,
      'line-opacity': 0.92,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.8, 7, 4.5],
      'line-blur': 0.7,
    },
  })

  map.addSource('poems', {
    type: 'geojson',
    data: poemCollection(poems, selectedPoemId),
  })
  map.addLayer({
    id: 'poem-hit-target',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 22, 7, 28],
      'circle-color': '#ffffff',
      'circle-opacity': 0.001,
      'circle-pitch-alignment': 'viewport',
    },
  })
}

async function addWebglLabelLayers(
  map: MapLibreMap,
  container: HTMLElement,
  poems: Poem[],
  showTangContext: boolean,
) {
  await document.fonts.ready
  try {
    if (!map.getSource('poems')) return
  } catch {
    return
  }

  if (showTangContext) {
    tangMapLabels.forEach((label, index) => {
      const id = `tang-label-${index}`
      if (map.hasImage(id)) return
      const rendered = createLabelImage(label.name, label.kind)
      if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
    })
  }
  const poemGroups = elevateNearbyPoemPlaces(poems)
  poemGroups.forEach((group, index) => {
    const id = `poem-label-${index}`
    if (map.hasImage(id)) return
    const rendered = createPoemLabelImage(group.placeName)
    if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
  })
  new Set(poemGroups.map((group) => group.poems.length).filter((count) => count > 1))
    .forEach((count) => {
      const id = `poem-count-${count}`
      if (map.hasImage(id)) return
      const rendered = createPoemCountImage(count)
      if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
    })
  const markerStates = ['idle', 'selected'] as const
  new Set(poemGroups.map((group) => group.liftTier)).forEach((liftTier) => {
    markerStates.forEach((state) => {
      const id = `poem-marker-${liftTier}-${state}`
      if (map.hasImage(id)) return
      const rendered = createPoemMarkerImage(liftTier, state === 'selected')
      if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
    })
  })
  if (showTangContext) {
    map.addSource('tang-labels', {
      type: 'geojson',
      data: historicalLabelCollection(),
    })
    map.addLayer({
      id: 'tang-region-labels',
      type: 'symbol',
      source: 'tang-labels',
      maxzoom: 4.45,
      filter: ['==', ['get', 'kind'], 'region'],
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-allow-overlap': false,
        'icon-padding': 5,
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
      paint: {
        'icon-opacity': ['case', ['get', 'major'], 0.9, 0.66],
      },
    })
    map.addLayer({
      id: 'tang-prefecture-labels',
      type: 'symbol',
      source: 'tang-labels',
      minzoom: 4.25,
      filter: ['==', ['get', 'kind'], 'prefecture'],
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-allow-overlap': false,
        'icon-padding': 4,
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
      paint: {
        'icon-opacity': ['case', ['get', 'major'], 0.92, 0.72],
      },
    })
  }
  map.addLayer({
    id: 'poem-location-markers',
    type: 'symbol',
    source: 'poems',
    layout: {
      'icon-image': ['get', 'markerImageId'],
      'icon-size': ['case', ['get', 'selected'], 1.08, 1],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'symbol-sort-key': ['get', 'liftTier'],
    },
    paint: {
      // Keep a legible overview: the selected poem and a representative set
      // remain visible, while dense local markers progressively appear as the
      // reader zooms in. The library still exposes every work at every zoom.
      'icon-opacity': [
        'interpolate', ['linear'], ['zoom'],
        4.8, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0],
        5.2, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0.34],
        5.7, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0.82],
      ],
    },
  })
  map.addLayer({
    id: 'poem-cluster-counts',
    type: 'symbol',
    source: 'poems',
    filter: ['>', ['get', 'count'], 1],
    layout: {
      'icon-image': ['get', 'countImageId'],
      'icon-anchor': 'bottom',
      'icon-offset': ['get', 'countOffset'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
    paint: {
      'icon-opacity': [
        'interpolate', ['linear'], ['zoom'],
        4.8, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0],
        5.2, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0.34],
        5.7, ['case', ['get', 'selected'], 1, ['<=', ['get', 'priority'], 1], 0.9, 0.82],
      ],
    },
  })
  map.addLayer({
    id: 'poem-place-labels',
    type: 'symbol',
    source: 'poems',
    minzoom: 3.3,
    filter: ['==', ['get', 'selected'], false],
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-offset': ['get', 'labelOffset'],
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'icon-padding': 7,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'symbol-sort-key': ['get', 'priority'],
    },
    paint: {
      'icon-opacity': [
        'interpolate', ['linear'], ['zoom'],
        4.8, ['case', ['<=', ['get', 'priority'], 1], 0.82, 0],
        5.2, ['case', ['<=', ['get', 'priority'], 1], 0.82, 0.42],
        5.7, 0.82,
      ],
    },
  })
  map.addLayer({
    id: 'poem-selected-place-label',
    type: 'symbol',
    source: 'poems',
    minzoom: 3.3,
    filter: ['==', ['get', 'selected'], true],
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-size': 1.14,
      'icon-anchor': 'bottom',
      'icon-offset': ['get', 'labelOffset'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-padding': 3,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
    paint: {
      'icon-opacity': 1,
    },
  })
  container.setAttribute('data-poem-density-policy', 'progressive-disclosure')
  container.setAttribute('data-history-ready', 'true')
}

function splitVerseSentences(lines: string[]) {
  return lines.flatMap((line) =>
    line.match(/[^，。！？；!?;]+[，。！？；!?;]?/gu)?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [line],
  )
}

function balanceVerseColumns(sentences: string[], maximumColumns: number) {
  if (sentences.length <= maximumColumns) return sentences

  const columnCount = Math.max(1, maximumColumns)
  const remainingCharacters = sentences
    .map((sentence) => [...sentence].length)
    .reduce((sum, length) => sum + length, 0)
  const columns: string[] = []
  let sentenceIndex = 0
  let consumedCharacters = 0

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const columnsLeft = columnCount - columnIndex
    const targetLength = (remainingCharacters - consumedCharacters) / columnsLeft
    let column = ''
    let columnLength = 0

    while (sentenceIndex < sentences.length) {
      const sentence = sentences[sentenceIndex]
      const sentenceLength = [...sentence].length
      const sentencesLeftAfter = sentences.length - sentenceIndex - 1
      const mustLeaveOnePerColumn = sentencesLeftAfter < columnsLeft - 1
      if (column && (mustLeaveOnePerColumn || columnLength + sentenceLength > targetLength)) break
      column += sentence
      columnLength += sentenceLength
      sentenceIndex += 1
      if (sentences.length - sentenceIndex === columnsLeft - 1) break
    }

    columns.push(column)
    consumedCharacters += columnLength
  }

  return columns.filter(Boolean)
}

function compactVerticalLabel(value: string) {
  const compacted = value
    .replace(/\s*·\s*/gu, '·')
    .trim()
  return [...compacted].slice(0, 7).join('')
}

function fitVerticalText(
  value: string,
  columnHeight: number,
  maximumSize: number,
  letterSpacingEm: number,
) {
  const characters = Math.max(1, [...value].length)
  // Keep a small physical safety margin for CJK glyph ascenders, punctuation
  // and browser sub-pixel rounding in vertical writing mode.
  const fittedSize = (columnHeight
    / (characters + Math.max(0, characters - 1) * letterSpacingEm)) * 0.86
  return Math.min(maximumSize, fittedSize)
}

function sizeVerticalVerseMarker(element: HTMLElement, poem: Poem) {
  const compact = window.matchMedia('(max-width: 680px)').matches
  const sentences = splitVerseSentences(poem.lines)
  const maximumFontSize = compact ? 13 : 16
  const lineHeight = compact ? 1.32 : 1.45
  const columnGap = compact ? 4 : 6
  const signWidth = Math.min(
    compact ? window.innerWidth - 26 : 520,
    window.innerWidth - (compact ? 26 : 48),
  )
  // Padding, title, author, place label, dividers and the gaps between those
  // fixed columns. Keeping this separate from verse gaps makes the frame's
  // width deterministic instead of relying on flexbox to squeeze long ci.
  const fixedColumnsWidth = compact ? 88 : 122
  const preferredColumnWidth = maximumFontSize * lineHeight
  const maximumColumns = Math.max(
    1,
    Math.floor(
      (signWidth - fixedColumnsWidth + columnGap)
      / (preferredColumnWidth + columnGap),
    ),
  )
  const columns = balanceVerseColumns(sentences, maximumColumns)
  const longestSentence = Math.max(
    1,
    ...columns.map((column) => [...column].length),
  )
  const letterSpacingEm = compact ? 0.02 : 0.045
  const heightBudget = compact
    ? Math.min(320, Math.max(184, window.innerHeight * 0.38))
    : Math.min(380, Math.max(220, window.innerHeight * 0.42))
  const heightFit = heightBudget
    / (longestSentence + Math.max(0, longestSentence - 1) * letterSpacingEm)
  const verseGapsWidth = Math.max(0, columns.length - 1) * columnGap
  const widthFit = (signWidth - fixedColumnsWidth - verseGapsWidth)
    / Math.max(1, columns.length)
    / lineHeight
  const minimumFontSize = compact ? 9.5 : 11
  const fontSize = Math.min(
    maximumFontSize,
    Math.max(minimumFontSize, Math.min(heightFit, widthFit)),
  )
  // Chromium's vertical CJK glyph advance can exceed the nominal font size,
  // especially around rotated punctuation. Reserve measured headroom so a
  // final long column never clips even when the arithmetic character count fits.
  const columnHeight = fontSize
    * (longestSentence + Math.max(0, longestSentence - 1) * letterSpacingEm)
    * 1.1
  const titleSize = fitVerticalText(
    poem.title,
    columnHeight,
    compact ? Math.min(19, fontSize * 1.48) : Math.min(25, fontSize * 1.52),
    0.12,
  )
  const authorLabel = `${dynastyLabels[poem.dynasty]}·${poem.author}`
  const metaLabel = `${compactVerticalLabel(poem.placeName)}·${compactVerticalLabel(poem.visualEffectLabel)}`
  const authorSize = fitVerticalText(authorLabel, columnHeight, compact ? 9 : 12, 0.05)
  const metaSize = fitVerticalText(metaLabel, columnHeight, compact ? 8 : 10, 0.04)
  const frameWidth = Math.min(
    signWidth,
    fixedColumnsWidth + verseGapsWidth + columns.length * fontSize * lineHeight,
  )

  element.style.setProperty('--map-poem-font-size', `${fontSize.toFixed(2)}px`)
  element.style.setProperty('--map-poem-title-size', `${titleSize.toFixed(2)}px`)
  element.style.setProperty('--map-poem-author-size', `${authorSize.toFixed(2)}px`)
  element.style.setProperty('--map-poem-meta-size', `${metaSize.toFixed(2)}px`)
  // Leave a few physical pixels for font ascenders, punctuation and browser
  // sub-pixel rounding while keeping every item inside the same visual column.
  element.style.setProperty('--map-poem-column-height', `${(columnHeight + 3).toFixed(2)}px`)
  element.style.setProperty('--map-poem-frame-width', `${Math.ceil(frameWidth)}px`)
  element.dataset.sentenceCount = String(sentences.length)
  element.dataset.columnCount = String(columns.length)
  const lines = element.querySelector<HTMLElement>('.map-poem-lines')
  const layoutKey = columns.join('\n')
  if (lines && lines.dataset.layoutKey !== layoutKey) {
    lines.replaceChildren(...columns.map((column) => {
      const verseLine = document.createElement('p')
      verseLine.textContent = column
      return verseLine
    }))
    lines.dataset.layoutKey = layoutKey
  }
  delete element.dataset.baseWidth
  delete element.dataset.baseHeight
}

function scaleVerticalVerseMarker(element: HTMLElement, map: MapLibreMap) {
  const compact = window.matchMedia('(max-width: 680px)').matches
  const zoomRange = Math.max(0.01, map.getMaxZoom() - map.getMinZoom())
  const progress = Math.min(
    1,
    Math.max(0, (map.getZoom() - map.getMinZoom()) / zoomRange),
  )
  const desiredScale = 1 + progress * (compact ? 0.3 : 0.42)
  const baseWidth = Number(element.dataset.baseWidth) || element.offsetWidth
  const baseHeight = Number(element.dataset.baseHeight) || element.offsetHeight

  if (baseWidth > 0 && baseHeight > 0) {
    element.dataset.baseWidth = String(baseWidth)
    element.dataset.baseHeight = String(baseHeight)
  }

  const widthLimit = (window.innerWidth - (compact ? 20 : 64)) / Math.max(1, baseWidth)
  const heightLimit = (window.innerHeight * (compact ? 0.62 : 0.68)) / Math.max(1, baseHeight)
  const scale = Math.max(1, Math.min(desiredScale, widthLimit, heightLimit))
  const formattedScale = scale.toFixed(3)

  if (element.dataset.zoomScale !== formattedScale) {
    element.style.setProperty('--map-poem-zoom-scale', formattedScale)
    element.dataset.zoomScale = formattedScale
  }
}

function createVerticalVerseMarker(poem: Poem) {
  const element = document.createElement('article')
  element.className = 'map-poem-sign'
  element.setAttribute('role', 'article')
  element.setAttribute('aria-label', `${poem.author}《${poem.title}》`)
  element.dataset.poemId = poem.id

  const heading = document.createElement('h1')
  heading.textContent = poem.title
  const author = document.createElement('p')
  author.className = 'map-poem-author'
  author.textContent = `${dynastyLabels[poem.dynasty]}·${poem.author}`
  const lines = document.createElement('div')
  lines.className = 'map-poem-lines'
  lines.setAttribute('aria-label', poem.lines.join(''))
  const place = document.createElement('footer')
  place.textContent = `${compactVerticalLabel(poem.placeName)}·${compactVerticalLabel(poem.visualEffectLabel)}`
  element.append(heading, author, lines, place)
  sizeVerticalVerseMarker(element, poem)
  return new Marker({ element, anchor: 'bottom', offset: [0, -28] })
}

function createPoemEffectMarker(poem: Poem) {
  const element = document.createElement('div')
  element.className = `poem-effect effect-${poem.visualEffect}`
  element.setAttribute('aria-hidden', 'true')
  element.style.setProperty('--effect-accent', poem.accent)

  const core = document.createElement('span')
  core.className = 'effect-core'
  element.append(core)
  for (let index = 0; index < 8; index += 1) {
    const particle = document.createElement('i')
    particle.style.setProperty('--particle-index', String(index))
    element.append(particle)
  }

  return new Marker({ element, anchor: 'center' })
}

function createPoemGroupPicker(
  poems: Poem[],
  onSelect: (poem: Poem) => void,
) {
  const element = document.createElement('div')
  element.className = 'poem-group-picker'
  element.setAttribute('role', 'group')
  element.setAttribute('aria-label', `${poems[0].placeName}的${poems.length}首诗`)
  const center = document.createElement('span')
  center.className = 'poem-group-center'
  center.textContent = String(poems.length)
  center.setAttribute('aria-hidden', 'true')
  element.append(center)

  poems.forEach((poem, index) => {
    // Fan choices into the lower semicircle. The verse slip grows upward from
    // the same geographic anchor, so an upper choice would cover its final
    // columns and make the transient selection state hard to read.
    const angle = poems.length === 1
      ? 90
      : 20 + (140 / (poems.length - 1)) * index
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'poem-group-choice'
    button.style.setProperty('--choice-angle', `${angle}deg`)
    button.style.setProperty('--choice-angle-inverse', `${-angle}deg`)
    button.title = `${poem.author}《${poem.title}》`
    button.setAttribute('aria-label', `选择${poem.author}《${poem.title}》`)
    const title = document.createElement('strong')
    title.textContent = poem.title
    const author = document.createElement('small')
    author.textContent = poem.author
    button.append(title, author)
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      onSelect(poem)
    })
    element.append(button)
  })

  return new Marker({ element, anchor: 'center', subpixelPositioning: true })
}

function focusSelectedPoem(map: MapLibreMap, poem: Poem) {
  const compact = window.matchMedia('(max-width: 680px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  map.easeTo({
    center: [poem.longitude, poem.latitude],
    zoom: compact ? 4.55 : 4.7,
    pitch: compact ? 42 : 48,
    // A pitched, rotated camera turns the vertical focus offset into a
    // horizontal drift. Long poem slips then cross the narrow viewport edge.
    bearing: compact ? 0 : -8,
    offset: compact ? [0, 128] : [0, 112],
    duration: reducedMotion ? 0 : 1_450,
    easing: (time) => 1 - Math.pow(1 - time, 3),
  })
}

export function VerseScene({
  poems,
  selectedPoem,
  season,
  onSelectPoem,
  onFocusChange,
}: VerseSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const selectedMarkerRef = useRef<Marker | null>(null)
  const effectMarkerRef = useRef<Marker | null>(null)
  const groupPickerRef = useRef<Marker | null>(null)
  const selectionInitializedRef = useRef(false)
  const introInProgressRef = useRef(false)
  const pendingFocusRef = useRef<Poem | null>(null)
  const selectedPoemRef = useRef(selectedPoem)
  const journeyOriginRef = useRef(selectedPoem)
  const routeAnimationFrameRef = useRef(0)
  const routeSettleTimerRef = useRef(0)
  const seasonRef = useRef(season)
  const onSelectRef = useRef(onSelectPoem)
  const onFocusRef = useRef(onFocusChange)

  useEffect(() => {
    onSelectRef.current = onSelectPoem
  }, [onSelectPoem])

  useEffect(() => {
    onFocusRef.current = onFocusChange
  }, [onFocusChange])

  useEffect(() => {
    selectedPoemRef.current = selectedPoem
  }, [selectedPoem])

  useEffect(() => {
    seasonRef.current = season
    const map = mapRef.current
    containerRef.current?.setAttribute('data-season', season)
    if (map?.isStyleLoaded()) applySeasonPalette(map, season)
  }, [season])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const compact = window.matchMedia('(max-width: 680px)').matches
    const elevatedPlaces = elevateNearbyPoemPlaces(poems)
    type WheelFocusPath = {
      poemId: string
      originZoom: number
      originCenter: LngLat
      poemCenter: LngLat
      targetCenter: LngLat
    }
    let wheelFocusPath: WheelFocusPath | null = null
    let wheelGestureActive = false
    let wheelFocusTimer = 0
    const map = new MapLibreMap({
      container: containerRef.current,
      style: geographicStyle,
      center: compact ? [104, 34] : [101, 34],
      zoom: compact ? 3.55 : 4.2,
      pitch: compact ? 34 : 38,
      bearing: -8,
      maxBounds: classicalChinaBounds,
      maxPitch: 62,
      minZoom: compact ? 3.3 : 4,
      maxZoom: 8,
      renderWorldCopies: false,
      maxTileCacheSize: compact ? 24 : 48,
      cancelPendingTileRequestsWhileZooming: true,
      refreshExpiredTiles: false,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      attributionControl: false,
      fadeDuration: 0,
      transformCameraUpdate: (next) => {
        const path = wheelFocusPath
        if (
          !wheelGestureActive
          || !path
          || path.poemId !== selectedPoemRef.current.id
        ) return {}

        const boundedZoom = Math.max(next.zoom, path.originZoom)
        const zoomDelta = boundedZoom - path.originZoom
        const offsetDecay = 2 ** -zoomDelta
        const targetLng = path.poemCenter.lng
          + (path.targetCenter.lng - path.poemCenter.lng) * offsetDecay
        const targetLat = path.poemCenter.lat
          + (path.targetCenter.lat - path.poemCenter.lat) * offsetDecay
        const attraction = Math.min(0.985, 1 - Math.exp(-zoomDelta * 2.8))
        const focusedCenter = new LngLat(
          path.originCenter.lng + (targetLng - path.originCenter.lng) * attraction,
          path.originCenter.lat + (targetLat - path.originCenter.lat) * attraction,
        )

        return {
          center: focusedCenter,
          zoom: boundedZoom,
        }
      },
      canvasContextAttributes: {
        antialias: false,
        powerPreference: 'high-performance',
        desynchronized: true,
      },
    })
    mapRef.current = map
    introInProgressRef.current = true

    const compass = document.createElement('button')
    compass.type = 'button'
    compass.className = 'verse-compass'
    compass.setAttribute('aria-label', '归正地图方向')
    compass.innerHTML = '<span>南</span><i></i>'
    compass.addEventListener('click', () => {
      wheelFocusPath = null
      map.easeTo({ bearing: 0, pitch: compact ? 38 : 44, duration: 700 })
    })
    containerRef.current.append(compass)
    let focusFrame = 0
    let lastFocusReport = 0
    const updateMarkerDensity = () => {
      containerRef.current?.classList.toggle('map-near', map.getZoom() >= 4.25)
    }
    const updateVerseSizing = () => {
      const markerElement = selectedMarkerRef.current?.getElement()
      if (markerElement) {
        sizeVerticalVerseMarker(markerElement, selectedPoemRef.current)
        scaleVerticalVerseMarker(markerElement, map)
      }
    }
    const updateVerseScale = () => {
      const markerElement = selectedMarkerRef.current?.getElement()
      if (markerElement) scaleVerticalVerseMarker(markerElement, map)
    }
    const updatePoemScreenPositions = () => {
      const positions = Object.fromEntries(poems.map((poem) => {
        const point = map.project([poem.longitude, poem.latitude])
        return [poem.id, { x: Math.round(point.x), y: Math.round(point.y) }]
      }))
      containerRef.current?.setAttribute('data-poem-screen-positions', JSON.stringify(positions))
    }
    const reportFocus = (force = false) => {
      const now = performance.now()
      if (!force && now - lastFocusReport < 120) return
      if (focusFrame) return
      focusFrame = window.requestAnimationFrame(() => {
        const center = map.getCenter()
        onFocusRef.current(projectPoint(center.lng, center.lat))
        lastFocusReport = performance.now()
        focusFrame = 0
      })
    }
    const finishWheelFocus = () => {
      wheelGestureActive = false
      if (wheelFocusTimer) window.clearTimeout(wheelFocusTimer)
      wheelFocusTimer = 0
      containerRef.current?.classList.remove('map-wheel-zooming')
    }
    const handleWheelFocus = (event: WheelEvent) => {
      const markerElement = selectedMarkerRef.current?.getElement()
      if (!markerElement) return
      const poem = selectedPoemRef.current
      if (wheelFocusPath?.poemId !== poem.id) wheelFocusPath = null
      if (
        event.deltaY > 0
        && wheelFocusPath
        && map.getZoom() <= wheelFocusPath.originZoom + 0.015
      ) {
        // The inverse journey has reached its origin. A further outward wheel
        // gesture starts ordinary map zooming from that point.
        wheelFocusPath = null
      }
      if (event.deltaY < 0 && !wheelFocusPath) {
        const poemCenter = new LngLat(poem.longitude, poem.latitude)
        const poemPoint = map.project(poemCenter)
        const markerScale = Number(markerElement.dataset.zoomScale) || 1
        const markerHeight = markerElement.offsetHeight * markerScale
        const poemOffset = Math.min(window.innerHeight * 0.3, markerHeight / 2 + 28)
        wheelFocusPath = {
          poemId: poem.id,
          originZoom: map.getZoom(),
          originCenter: map.getCenter(),
          poemCenter,
          targetCenter: map.unproject([poemPoint.x, poemPoint.y - poemOffset]),
        }
      }

      wheelGestureActive = true
      containerRef.current?.classList.add('map-wheel-zooming')
      if (wheelFocusTimer) window.clearTimeout(wheelFocusTimer)
      // `zoomend` normally closes the session. Keep a generous fallback for
      // slow WebGL frames so the final camera update cannot lose its focus.
      wheelFocusTimer = window.setTimeout(finishWheelFocus, 1_200)
    }
    const canvas = map.getCanvas()
    canvas.addEventListener('wheel', handleWheelFocus, { passive: true, capture: true })

    map.once('style.load', () => {
      const showTangContext = selectedPoemRef.current.dynasty === 'tang'
      addHistoricalLayers(map, poems, selectedPoemRef.current.id, showTangContext)
      containerRef.current?.setAttribute('data-map-scope', 'classical-china')
      containerRef.current?.setAttribute('data-dynasty', selectedPoemRef.current.dynasty)
      containerRef.current?.setAttribute(
        'data-history-layer',
        showTangContext ? 'tang-context' : 'poem-context',
      )
      containerRef.current?.setAttribute('data-boundary-rendered', 'false')
      containerRef.current?.setAttribute('data-poem-point-style', 'abstract-slip')
      containerRef.current?.setAttribute('data-poem-route-renderer', 'webgl-gradient')
      containerRef.current?.setAttribute('data-poem-route-state', 'idle')
      containerRef.current?.setAttribute(
        'data-poem-place-groups',
        JSON.stringify(elevatedPlaces.map((group) => ({
          key: group.key,
          count: group.poems.length,
          liftTier: group.liftTier,
          markerHeight: poemMarkerHeight(group.liftTier),
          hasNearbyPlace: group.hasNearbyPlace,
        }))),
      )
      containerRef.current?.setAttribute('data-poem-hit-ready', 'true')
      applySeasonPalette(map, seasonRef.current)
      if (containerRef.current) {
        void addWebglLabelLayers(map, containerRef.current, poems, showTangContext)
      }
      updateMarkerDensity()
      containerRef.current?.setAttribute('data-map-ready', 'true')
      reportFocus()
      window.requestAnimationFrame(() => {
        containerRef.current?.classList.add('map-intro-moving')
        let introFinished = false
        const finishIntro = () => {
          if (introFinished) return
          introFinished = true
          map.off('moveend', finishIntro)
          introInProgressRef.current = false
          containerRef.current?.classList.remove('map-intro-moving')
          containerRef.current?.setAttribute('data-intro-complete', 'true')
          const pendingPoem = pendingFocusRef.current
          pendingFocusRef.current = null
          focusSelectedPoem(map, pendingPoem ?? selectedPoemRef.current)
        }
        // Register before `easeTo`: MapLibre completes motion synchronously
        // when the operating system requests reduced motion.
        map.once('moveend', finishIntro)
        map.easeTo({
          center: compact ? [105.5, 33.2] : [101.5, 34.2],
          zoom: compact ? 3.72 : 4.45,
          pitch: compact ? 42 : 46,
          bearing: -10,
          duration: 2_400,
          easing: (time) => 1 - Math.pow(1 - time, 3),
        })
      })
    })
    const findMarkerGroup = (point: { x: number; y: number }) => {
      let closestGroup: (typeof elevatedPlaces)[number] | undefined
      let closestScore = Number.POSITIVE_INFINITY
      elevatedPlaces.forEach((group) => {
        const ground = map.project([group.longitude, group.latitude])
        const head = {
          x: ground.x,
          y: ground.y - poemMarkerHeight(group.liftTier) + poemMarkerHeadCenterY,
        }
        const headDistance = Math.hypot(point.x - head.x, point.y - head.y)
        const baseDistance = Math.hypot(point.x - ground.x, point.y - ground.y)
        const score = Math.min(headDistance / 21, baseDistance / 24)
        if (score <= 1 && score < closestScore) {
          closestGroup = group
          closestScore = score
        }
      })
      return closestGroup
    }

    map.on('click', (event) => {
      const directGroup = findMarkerGroup(event.point)
      const layers = ['poem-hit-target']
      if (map.getLayer('poem-place-labels')) layers.push('poem-place-labels')
      if (map.getLayer('poem-selected-place-label')) layers.push('poem-selected-place-label')
      const feature = directGroup
        ? undefined
        : map.queryRenderedFeatures(event.point, { layers })[0]
      if (!directGroup && !feature) {
        groupPickerRef.current?.remove()
        groupPickerRef.current = null
        return
      }
      let memberIds: string[] = []
      if (!directGroup) {
        try {
          memberIds = JSON.parse(String(feature?.properties?.memberIds ?? '[]')) as string[]
        } catch {
          memberIds = []
        }
      }
      const groupPoems = directGroup?.poems
        ?? memberIds
          .map((id) => poems.find((poem) => poem.id === id))
          .filter((poem): poem is Poem => Boolean(poem))
      const fallbackPoem = directGroup?.poems[0]
        ?? poems.find((poem) => poem.id === feature?.properties?.id)
      if (groupPoems.length <= 1) {
        groupPickerRef.current?.remove()
        groupPickerRef.current = null
        const poem = groupPoems[0] ?? fallbackPoem
        if (poem) onSelectRef.current(poem)
        return
      }

      groupPickerRef.current?.remove()
      const representative = groupPoems[0]
      groupPickerRef.current = createPoemGroupPicker(groupPoems, (poem) => {
        groupPickerRef.current?.remove()
        groupPickerRef.current = null
        onSelectRef.current(poem)
      })
        .setLngLat([representative.longitude, representative.latitude])
        .addTo(map)
    })
    map.on('mousemove', (event) => {
      if (findMarkerGroup(event.point)) {
        map.getCanvas().style.cursor = 'pointer'
        return
      }
      const labelLayers = [
        map.getLayer('poem-place-labels') ? 'poem-place-labels' : '',
        map.getLayer('poem-selected-place-label') ? 'poem-selected-place-label' : '',
      ].filter(Boolean)
      const overLabel = labelLayers.length > 0
        && map.queryRenderedFeatures(event.point, { layers: labelLayers }).length > 0
      map.getCanvas().style.cursor = overLabel ? 'pointer' : ''
    })
    map.on('dragstart', () => {
      wheelFocusPath = null
    })
    map.on('rotatestart', () => {
      wheelFocusPath = null
    })
    map.on('pitchstart', () => {
      wheelFocusPath = null
    })
    map.on('movestart', () => {
      containerRef.current?.classList.add('map-moving')
      groupPickerRef.current?.remove()
      groupPickerRef.current = null
    })
    map.on('move', () => reportFocus())
    map.on('moveend', () => {
      containerRef.current?.classList.remove('map-moving')
      updatePoemScreenPositions()
      reportFocus(true)
    })
    map.on('zoom', () => {
      updateMarkerDensity()
      updateVerseScale()
    })
    map.on('zoomend', finishWheelFocus)
    map.on('resize', () => {
      updateVerseSizing()
      updatePoemScreenPositions()
    })

    return () => {
      if (focusFrame) window.cancelAnimationFrame(focusFrame)
      if (routeAnimationFrameRef.current) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current)
        routeAnimationFrameRef.current = 0
      }
      if (routeSettleTimerRef.current) {
        window.clearTimeout(routeSettleTimerRef.current)
        routeSettleTimerRef.current = 0
      }
      finishWheelFocus()
      wheelFocusPath = null
      canvas.removeEventListener('wheel', handleWheelFocus, true)
      compass.remove()
      selectedMarkerRef.current?.remove()
      effectMarkerRef.current?.remove()
      groupPickerRef.current?.remove()
      selectedMarkerRef.current = null
      effectMarkerRef.current = null
      groupPickerRef.current = null
      selectionInitializedRef.current = false
      introInProgressRef.current = false
      pendingFocusRef.current = null
      journeyOriginRef.current = selectedPoemRef.current
      map.remove()
      mapRef.current = null
    }
  }, [poems])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const previousPoem = journeyOriginRef.current
    journeyOriginRef.current = selectedPoem
    selectedMarkerRef.current?.remove()
    effectMarkerRef.current?.remove()
    groupPickerRef.current?.remove()
    groupPickerRef.current = null
    effectMarkerRef.current = createPoemEffectMarker(selectedPoem)
      .setLngLat([selectedPoem.longitude, selectedPoem.latitude])
      .addTo(map)
    selectedMarkerRef.current = createVerticalVerseMarker(selectedPoem)
      .setLngLat([selectedPoem.longitude, selectedPoem.latitude])
      .addTo(map)
    scaleVerticalVerseMarker(selectedMarkerRef.current.getElement(), map)

    const source = map.getSource('poems') as GeoJSONSource | undefined
    if (source) source.setData(poemCollection(poems, selectedPoem.id))

    if (!selectionInitializedRef.current) {
      selectionInitializedRef.current = true
      return
    }

    const routeSource = map.getSource('poem-route') as GeoJSONSource | undefined
    if (routeSource && previousPoem.id !== selectedPoem.id) {
      if (routeAnimationFrameRef.current) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current)
        routeAnimationFrameRef.current = 0
      }
      if (routeSettleTimerRef.current) {
        window.clearTimeout(routeSettleTimerRef.current)
        routeSettleTimerRef.current = 0
      }

      const route = poemRoute(previousPoem, selectedPoem)
      routeSource.setData(route)
      containerRef.current?.setAttribute('data-poem-route-from', previousPoem.id)
      containerRef.current?.setAttribute('data-poem-route-to', selectedPoem.id)

      if (route.features.length === 0) {
        containerRef.current?.setAttribute('data-poem-route-state', 'same-place')
      } else {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        map.setPaintProperty('poem-route-ink', 'line-gradient', routeInkGradient(0))
        map.setPaintProperty('poem-route-flow', 'line-gradient', transparentRouteGradient)

        if (reducedMotion) {
          map.setPaintProperty('poem-route-ink', 'line-gradient', routeInkGradient(1))
          containerRef.current?.setAttribute('data-poem-route-state', 'settled')
        } else {
          const startedAt = performance.now()
          let lastPaintAt = 0
          containerRef.current?.setAttribute('data-poem-route-state', 'animating')
          const drawRoute = (now: number) => {
            const linearProgress = Math.min(1, (now - startedAt) / 1_600)
            if (linearProgress < 1 && now - lastPaintAt < 32) {
              routeAnimationFrameRef.current = window.requestAnimationFrame(drawRoute)
              return
            }
            const progress = linearProgress * linearProgress * (3 - 2 * linearProgress)
            lastPaintAt = now
            map.setPaintProperty('poem-route-ink', 'line-gradient', routeInkGradient(progress))
            map.setPaintProperty('poem-route-flow', 'line-gradient', routeFlowGradient(progress))

            if (linearProgress < 1) {
              routeAnimationFrameRef.current = window.requestAnimationFrame(drawRoute)
              return
            }

            routeAnimationFrameRef.current = 0
            containerRef.current?.setAttribute('data-poem-route-state', 'settled')
            routeSettleTimerRef.current = window.setTimeout(() => {
              if (map.getLayer('poem-route-flow')) {
                map.setPaintProperty(
                  'poem-route-flow',
                  'line-gradient',
                  transparentRouteGradient,
                )
              }
              routeSettleTimerRef.current = 0
            }, 280)
          }
          routeAnimationFrameRef.current = window.requestAnimationFrame(drawRoute)
        }
      }
    }

    if (introInProgressRef.current) {
      pendingFocusRef.current = selectedPoem
      return
    }
    focusSelectedPoem(map, selectedPoem)
  }, [poems, selectedPoem])

  return (
    <div
      ref={containerRef}
      className="geographic-map"
      aria-label={`${dynastyLabels[selectedPoem.dynasty]}诗词 WebGL 地形地图`}
    />
  )
}
