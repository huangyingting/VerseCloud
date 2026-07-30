import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { activeSnapshot } from '../data/mapSnapshots'
import { tangMapLabels, tangRegionDivisions } from '../data/tangGeography'
import { projectPoint } from '../lib/geo'
import type { Poem, ScenePoint, Season } from '../types'

interface VerseSceneProps {
  poems: Poem[]
  selectedPoem: Poem
  season: Season
  onSelectPoem: (poem: Poem) => void
  onFocusChange: (point: ScenePoint) => void
}

// Vite does not discover MapLibre's import.meta.url worker when the library is
// loaded lazily. Importing it as an asset makes the production URL explicit.
setWorkerUrl(mapWorkerUrl)

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
  territory: string
  division: string
  ocean: string
  lake: string
  river: string
  water: string
}> = {
  spring: {
    background: '#0a1712', reliefHue: 12, reliefSaturation: -0.34, reliefBrightness: 0.5,
    territory: '#b89b66', division: '#c5af7d',
    ocean: '#08232a', lake: '#14373b', river: '#2f6360', water: '#103137',
  },
  summer: {
    background: '#071711', reliefHue: 32, reliefSaturation: -0.2, reliefBrightness: 0.45,
    territory: '#9f9c5d', division: '#a9b77a',
    ocean: '#06262c', lake: '#0d3b3d', river: '#326e67', water: '#0b3336',
  },
  autumn: {
    background: '#17140d', reliefHue: 338, reliefSaturation: -0.28, reliefBrightness: 0.48,
    territory: '#c08a4f', division: '#d0a46c',
    ocean: '#10242a', lake: '#29353a', river: '#657b73', water: '#1b3034',
  },
  winter: {
    background: '#0b1418', reliefHue: 188, reliefSaturation: -0.62, reliefBrightness: 0.56,
    territory: '#9ea9a0', division: '#b5c0b8',
    ocean: '#071d29', lake: '#17313d', river: '#6f9298', water: '#102936',
  },
}

const TANG_PITCH = 45
const TANG_BEARING = -8
const tangBoundaryPoints = (activeSnapshot.boundary ?? []).flatMap((polygon) =>
  polygon.flatMap((ring) => ring),
)
const tangLongitudes = tangBoundaryPoints.map(([longitude]) => longitude)
const tangLatitudes = tangBoundaryPoints.map(([, latitude]) => latitude)
const tangBounds: [[number, number], [number, number]] = [
  [Math.min(...tangLongitudes), Math.min(...tangLatitudes)],
  [Math.max(...tangLongitudes), Math.max(...tangLatitudes)],
]
// The interaction bounds are intentionally taller than the Tang outline. A
// portrait viewport needs that latitude room to contain the realm's full
// east-west span at 45 degrees; the outside-Tang WebGL mask still prevents any
// neighbouring basemap from becoming visible.
const tangInteractionBounds: [[number, number], [number, number]] = [
  [50, -75],
  [150, 80],
]

function overviewPadding(compact: boolean) {
  return compact
    ? { top: 116, right: 12, bottom: 24, left: 12 }
    : { top: 104, right: 28, bottom: 28, left: 28 }
}

function fitTangAtFortyFiveDegrees(map: MapLibreMap, compact: boolean) {
  const padding = overviewPadding(compact)
  map.setMinZoom(0)
  map.setMaxBounds(tangInteractionBounds)
  map.jumpTo({ pitch: TANG_PITCH, bearing: TANG_BEARING })
  map.fitBounds(tangBounds, {
    padding,
    pitch: TANG_PITCH,
    bearing: TANG_BEARING,
    linear: true,
    duration: 0,
  })

  // MapLibre's built-in fitBounds is calculated in a flat camera. Re-project
  // the actual Tang outline at 45 degrees and iteratively fit that screen-space
  // silhouette so every boundary point remains inside the usable viewport.
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const projected = tangBoundaryPoints.map(([longitude, latitude]) =>
      map.project([longitude, latitude]),
    )
    const minX = Math.min(...projected.map((point) => point.x))
    const maxX = Math.max(...projected.map((point) => point.x))
    const minY = Math.min(...projected.map((point) => point.y))
    const maxY = Math.max(...projected.map((point) => point.y))
    const availableWidth = map.getContainer().clientWidth - padding.left - padding.right
    const availableHeight = map.getContainer().clientHeight - padding.top - padding.bottom
    const scale = Math.min(
      availableWidth / Math.max(1, maxX - minX),
      availableHeight / Math.max(1, maxY - minY),
    ) * 0.985
    map.jumpTo({
      zoom: map.getZoom() + Math.log2(scale),
      pitch: TANG_PITCH,
      bearing: TANG_BEARING,
    })

    const adjusted = tangBoundaryPoints.map(([longitude, latitude]) =>
      map.project([longitude, latitude]),
    )
    const outlineCenterX = (
      Math.min(...adjusted.map((point) => point.x))
      + Math.max(...adjusted.map((point) => point.x))
    ) / 2
    const outlineCenterY = (
      Math.min(...adjusted.map((point) => point.y))
      + Math.max(...adjusted.map((point) => point.y))
    ) / 2
    const targetCenterX = (padding.left + map.getContainer().clientWidth - padding.right) / 2
    const targetCenterY = (padding.top + map.getContainer().clientHeight - padding.bottom) / 2
    const nextCenter = map.unproject([
      map.getContainer().clientWidth / 2 + outlineCenterX - targetCenterX,
      map.getContainer().clientHeight / 2 + outlineCenterY - targetCenterY,
    ])
    map.jumpTo({
      center: nextCenter,
      pitch: TANG_PITCH,
      bearing: TANG_BEARING,
    })
  }

  const fittedZoom = map.getZoom()
  map.setMinZoom(fittedZoom)
  const finalOutline = tangBoundaryPoints.map(([longitude, latitude]) =>
    map.project([longitude, latitude]),
  )
  const boundaryContained = finalOutline.every((point) =>
    point.x >= padding.left - 1
    && point.x <= map.getContainer().clientWidth - padding.right + 1
    && point.y >= padding.top - 1
    && point.y <= map.getContainer().clientHeight - padding.bottom + 1,
  )
  map.getContainer().setAttribute('data-boundary-contained', String(boundaryContained))
  return fittedZoom
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
  if (map.getLayer('tang-wash')) map.setPaintProperty('tang-wash', 'fill-color', palette.territory)
  if (map.getLayer('tang-region-line')) {
    map.setPaintProperty('tang-region-line', 'line-color', palette.division)
  }
}

function boundaryFeature(): GeoJSON.Feature<GeoJSON.MultiPolygon> {
  return {
    type: 'Feature',
    properties: {
      name: '盛唐概念疆域',
      year: activeSnapshot.year,
      interpretation: 'artistic',
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: activeSnapshot.boundary ?? [],
    },
  }
}

function outsideTangFeature(): GeoJSON.Feature<GeoJSON.Polygon> {
  const boundaryRing = activeSnapshot.boundary?.[0]?.[0] ?? []
  return {
    type: 'Feature',
    properties: { name: '唐代疆域外遮罩' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[-179, -80], [179, -80], [179, 80], [-179, 80], [-179, -80]],
        boundaryRing,
      ],
    },
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

function poemCollection(poems: Poem[], selectedPoemId?: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: poems.map((poem, index) => ({
      type: 'Feature',
      id: poem.id,
      properties: {
        id: poem.id,
        title: poem.title,
        author: poem.author,
        placeName: poem.placeName,
        accent: poem.accent,
        imageId: `poem-label-${index}`,
        selected: poem.id === selectedPoemId,
        priority: poem.id === selectedPoemId ? 0 : (index < 3 || poem.id === 'cui-hao-huanghelou' ? 1 : 2),
      },
      geometry: {
        type: 'Point',
        coordinates: [poem.longitude, poem.latitude],
      },
    })),
  }
}

function addHistoricalLayers(map: MapLibreMap, poems: Poem[], selectedPoemId: string) {
  map.addSource('tang-boundary', {
    type: 'geojson',
    data: boundaryFeature(),
  })
  map.addLayer({
    id: 'tang-wash',
    type: 'fill',
    source: 'tang-boundary',
    paint: {
      'fill-color': '#b79b5f',
      'fill-opacity': 0.085,
    },
  })
  map.addSource('outside-tang', {
    type: 'geojson',
    data: outsideTangFeature(),
  })
  map.addLayer({
    id: 'outside-tang-mask',
    type: 'fill',
    source: 'outside-tang',
    paint: {
      'fill-color': '#07100c',
      'fill-opacity': 0.94,
      'fill-antialias': false,
    },
  })
  map.addLayer({
    id: 'tang-outer-glow',
    type: 'line',
    source: 'tang-boundary',
    paint: {
      'line-color': '#1a1208',
      'line-opacity': 0.42,
      'line-width': 5,
      'line-blur': 5,
    },
  })
  map.addLayer({
    id: 'tang-line',
    type: 'line',
    source: 'tang-boundary',
    paint: {
      'line-color': '#e0c17c',
      'line-opacity': 0.68,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 6, 2.1],
      'line-dasharray': [2.4, 1.8],
    },
  })

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

  map.addSource('poems', {
    type: 'geojson',
    data: poemCollection(poems, selectedPoemId),
  })
  map.addLayer({
    id: 'poem-hit-target',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 19, 7, 25],
      'circle-color': '#ffffff',
      'circle-opacity': 0.001,
      'circle-pitch-alignment': 'viewport',
    },
  })
  map.addLayer({
    id: 'poem-halo',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        3, ['case', ['get', 'selected'], 20, 15],
        7, ['case', ['get', 'selected'], 31, 26],
      ],
      'circle-color': '#d7ba76',
      'circle-opacity': ['case', ['get', 'selected'], 0.28, 0.2],
      'circle-blur': 0.66,
      'circle-pitch-alignment': 'viewport',
    },
  })
  map.addLayer({
    id: 'poem-points',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        3, ['case', ['get', 'selected'], 10, 8],
        7, ['case', ['get', 'selected'], 15, 12],
      ],
      'circle-color': ['case', ['get', 'selected'], '#efc665', '#ddb95e'],
      'circle-stroke-color': ['case', ['get', 'selected'], '#fff8dc', '#f6e5bd'],
      'circle-stroke-width': ['case', ['get', 'selected'], 2.8, 2.2],
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.96],
      'circle-pitch-alignment': 'viewport',
    },
  })
}

async function addWebglLabelLayers(map: MapLibreMap, container: HTMLElement, poems: Poem[]) {
  await document.fonts.ready
  try {
    if (!map.getSource('tang-boundary')) return
  } catch {
    return
  }

  tangMapLabels.forEach((label, index) => {
    const id = `tang-label-${index}`
    if (map.hasImage(id)) return
    const rendered = createLabelImage(label.name, label.kind)
    if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
  })
  poems.forEach((poem, index) => {
    const id = `poem-label-${index}`
    if (map.hasImage(id)) return
    const rendered = createPoemLabelImage(poem.placeName)
    if (rendered) map.addImage(id, rendered.image, { pixelRatio: rendered.pixelRatio })
  })
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
  map.addLayer({
    id: 'poem-place-labels',
    type: 'symbol',
    source: 'poems',
    minzoom: 2.2,
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-size': ['case', ['get', 'selected'], 1.14, 1],
      'icon-anchor': 'bottom',
      'icon-offset': [0, -9],
      'icon-allow-overlap': false,
      'icon-padding': 3,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'symbol-sort-key': ['get', 'priority'],
    },
    paint: {
      'icon-opacity': ['case', ['get', 'selected'], 1, 0.88],
    },
  })
  container.setAttribute('data-history-ready', 'true')
}

function createVerticalVerseMarker(poem: Poem) {
  const element = document.createElement('article')
  element.className = 'map-poem-sign'
  element.setAttribute('role', 'article')
  element.setAttribute('aria-label', `${poem.author}《${poem.title}》`)

  const heading = document.createElement('h1')
  heading.textContent = poem.title
  const author = document.createElement('p')
  author.className = 'map-poem-author'
  author.textContent = `唐 · ${poem.author}`
  const lines = document.createElement('div')
  lines.className = 'map-poem-lines'
  lines.setAttribute('aria-label', poem.lines.join('，'))
  poem.lines.forEach((line) => {
    const verseLine = document.createElement('p')
    verseLine.textContent = line
    lines.append(verseLine)
  })
  const place = document.createElement('footer')
  place.textContent = `${poem.placeName} · ${poem.visualEffectLabel}`
  element.append(heading, author, lines, place)
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

function focusSelectedPoem(map: MapLibreMap, poem: Poem) {
  const compact = window.matchMedia('(max-width: 680px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  map.easeTo({
    center: [poem.longitude, poem.latitude],
    zoom: compact ? 4.55 : 4.7,
    pitch: TANG_PITCH,
    bearing: TANG_BEARING,
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
  const selectionInitializedRef = useRef(false)
  const introInProgressRef = useRef(false)
  const pendingFocusRef = useRef<Poem | null>(null)
  const selectedPoemRef = useRef(selectedPoem)
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
    const map = new MapLibreMap({
      container: containerRef.current,
      style: geographicStyle,
      center: compact ? [104, 34] : [101, 34],
      zoom: compact ? 3.55 : 4.2,
      pitch: TANG_PITCH,
      bearing: TANG_BEARING,
      maxBounds: tangInteractionBounds,
      minPitch: TANG_PITCH,
      maxPitch: TANG_PITCH,
      pitchWithRotate: false,
      touchPitch: false,
      minZoom: 0,
      maxZoom: 8,
      renderWorldCopies: false,
      maxTileCacheSize: compact ? 24 : 48,
      cancelPendingTileRequestsWhileZooming: true,
      refreshExpiredTiles: false,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      attributionControl: false,
      fadeDuration: 0,
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
      map.easeTo({ bearing: 0, pitch: TANG_PITCH, duration: 700 })
    })
    containerRef.current.append(compass)
    let focusFrame = 0
    let resizeFrame = 0
    let lastFocusReport = 0
    let overviewZoom = 0
    let fittingOverview = false
    const updateMarkerDensity = () => {
      containerRef.current?.classList.toggle('map-near', map.getZoom() >= 4.25)
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
    const refitOverview = () => {
      fittingOverview = true
      const wasAtOverview = overviewZoom === 0 || map.getZoom() <= overviewZoom + 0.08
      const previousCamera = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
      }
      const nextOverviewZoom = fitTangAtFortyFiveDegrees(
        map,
        window.matchMedia('(max-width: 680px)').matches,
      )
      overviewZoom = nextOverviewZoom
      if (!wasAtOverview) {
        map.setMinZoom(0)
        map.jumpTo({
          ...previousCamera,
          zoom: Math.max(previousCamera.zoom, nextOverviewZoom),
          pitch: TANG_PITCH,
        })
        map.setMinZoom(nextOverviewZoom)
      }
      containerRef.current?.setAttribute('data-pitch', String(TANG_PITCH))
      containerRef.current?.setAttribute('data-overview-zoom', nextOverviewZoom.toFixed(3))
      fittingOverview = false
    }

    map.once('style.load', () => {
      addHistoricalLayers(map, poems, selectedPoemRef.current.id)
      containerRef.current?.setAttribute('data-poem-hit-ready', 'true')
      applySeasonPalette(map, seasonRef.current)
      if (containerRef.current) void addWebglLabelLayers(map, containerRef.current, poems)
      updateMarkerDensity()
      containerRef.current?.setAttribute('data-map-ready', 'true')
      window.requestAnimationFrame(() => {
        refitOverview()
        introInProgressRef.current = false
        reportFocus(true)
        const pendingPoem = pendingFocusRef.current
        pendingFocusRef.current = null
        if (pendingPoem) focusSelectedPoem(map, pendingPoem)
      })
    })
    map.on('click', (event) => {
      const layers = ['poem-hit-target', 'poem-points']
      if (map.getLayer('poem-place-labels')) layers.push('poem-place-labels')
      const feature = map.queryRenderedFeatures(event.point, { layers })[0]
      const poem = poems.find((item) => item.id === feature?.properties?.id)
      if (poem) onSelectRef.current(poem)
    })
    map.on('mouseenter', 'poem-hit-target', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'poem-hit-target', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('movestart', () => containerRef.current?.classList.add('map-moving'))
    map.on('move', () => reportFocus())
    map.on('moveend', () => {
      containerRef.current?.classList.remove('map-moving')
      if (!fittingOverview && overviewZoom > 0 && map.getZoom() <= overviewZoom + 0.02) {
        refitOverview()
      }
      reportFocus(true)
    })
    map.on('zoom', updateMarkerDensity)
    map.on('resize', () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        if (map.isStyleLoaded()) refitOverview()
      })
    })

    return () => {
      if (focusFrame) window.cancelAnimationFrame(focusFrame)
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      compass.remove()
      selectedMarkerRef.current?.remove()
      effectMarkerRef.current?.remove()
      selectedMarkerRef.current = null
      effectMarkerRef.current = null
      selectionInitializedRef.current = false
      introInProgressRef.current = false
      pendingFocusRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [poems])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    selectedMarkerRef.current?.remove()
    effectMarkerRef.current?.remove()
    effectMarkerRef.current = createPoemEffectMarker(selectedPoem)
      .setLngLat([selectedPoem.longitude, selectedPoem.latitude])
      .addTo(map)
    selectedMarkerRef.current = createVerticalVerseMarker(selectedPoem)
      .setLngLat([selectedPoem.longitude, selectedPoem.latitude])
      .addTo(map)

    const source = map.getSource('poems') as GeoJSONSource | undefined
    if (source) source.setData(poemCollection(poems, selectedPoem.id))

    if (!selectionInitializedRef.current) {
      selectionInitializedRef.current = true
      return
    }
    if (introInProgressRef.current) {
      pendingFocusRef.current = selectedPoem
      return
    }
    focusSelectedPoem(map, selectedPoem)
  }, [poems, selectedPoem])

  return <div ref={containerRef} className="geographic-map" aria-label="唐代疆域 WebGL 地形地图" />
}
