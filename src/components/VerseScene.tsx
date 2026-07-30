import {
  AttributionControl,
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
import { tangMapLabels, tangRegionDivisions, type HistoricalMapLabel } from '../data/tangGeography'
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
      attribution: 'Natural Earth · OpenFreeMap',
    },
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '© OpenFreeMap · © OpenStreetMap contributors',
    },
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium',
      attribution: 'Terrain Tiles © Mapzen · elevation data sources include NASA and USGS',
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
      id: 'terrain-hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-shadow-color': '#040a07',
        'hillshade-highlight-color': '#c1ad7e',
        'hillshade-accent-color': '#45584d',
        'hillshade-exaggeration': 0.66,
        'hillshade-illumination-direction': 318,
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
  hillHighlight: string
  hillAccent: string
  territory: string
  division: string
  ocean: string
  lake: string
  river: string
  water: string
}> = {
  spring: {
    background: '#0a1712', reliefHue: 12, reliefSaturation: -0.34, reliefBrightness: 0.5,
    hillHighlight: '#c6b88a', hillAccent: '#536a58', territory: '#b89b66', division: '#c5af7d',
    ocean: '#08232a', lake: '#14373b', river: '#2f6360', water: '#103137',
  },
  summer: {
    background: '#071711', reliefHue: 32, reliefSaturation: -0.2, reliefBrightness: 0.45,
    hillHighlight: '#aebd83', hillAccent: '#3d6751', territory: '#9f9c5d', division: '#a9b77a',
    ocean: '#06262c', lake: '#0d3b3d', river: '#326e67', water: '#0b3336',
  },
  autumn: {
    background: '#17140d', reliefHue: 338, reliefSaturation: -0.28, reliefBrightness: 0.48,
    hillHighlight: '#c7a66f', hillAccent: '#71523b', territory: '#c08a4f', division: '#d0a46c',
    ocean: '#10242a', lake: '#29353a', river: '#657b73', water: '#1b3034',
  },
  winter: {
    background: '#0b1418', reliefHue: 188, reliefSaturation: -0.62, reliefBrightness: 0.56,
    hillHighlight: '#c8d0c8', hillAccent: '#586b6c', territory: '#9ea9a0', division: '#b5c0b8',
    ocean: '#071d29', lake: '#17313d', river: '#6f9298', water: '#102936',
  },
}

function applySeasonPalette(map: MapLibreMap, season: Season) {
  const palette = seasonPalettes[season]
  map.setPaintProperty('night-paper', 'background-color', palette.background)
  map.setPaintProperty('earth-relief', 'raster-hue-rotate', palette.reliefHue)
  map.setPaintProperty('earth-relief', 'raster-saturation', palette.reliefSaturation)
  map.setPaintProperty('earth-relief', 'raster-brightness-max', palette.reliefBrightness)
  map.setPaintProperty('terrain-hillshade', 'hillshade-highlight-color', palette.hillHighlight)
  map.setPaintProperty('terrain-hillshade', 'hillshade-accent-color', palette.hillAccent)
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

function poemCollection(poems: Poem[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: poems.map((poem) => ({
      type: 'Feature',
      id: poem.id,
      properties: {
        id: poem.id,
        title: poem.title,
        author: poem.author,
        placeName: poem.placeName,
        accent: poem.accent,
      },
      geometry: {
        type: 'Point',
        coordinates: [poem.longitude, poem.latitude],
      },
    })),
  }
}

function addHistoricalLayers(map: MapLibreMap, poems: Poem[]) {
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
    data: poemCollection(poems),
  })
  map.addLayer({
    id: 'poem-halo',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 13, 7, 24],
      'circle-color': '#d7ba76',
      'circle-opacity': 0.14,
      'circle-blur': 0.72,
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: 'poem-points',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5.5, 7, 10],
      'circle-color': '#d6b971',
      'circle-stroke-color': '#fff0c9',
      'circle-stroke-width': 1.2,
      'circle-opacity': 0.82,
      'circle-pitch-alignment': 'map',
    },
  })
}

function createHistoricalLabelMarker(label: HistoricalMapLabel) {
  const element = document.createElement('span')
  element.className = `historical-label historical-${label.kind}-label`
  if (label.major) element.classList.add('historical-major')
  element.textContent = label.name
  element.setAttribute('aria-hidden', 'true')
  return new Marker({ element, anchor: 'center' })
    .setLngLat([label.longitude, label.latitude])
}

function createPoemMarker(
  poem: Poem,
  prominent: boolean,
  onSelect: (poem: Poem) => void,
) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'geographic-poem-marker'
  button.dataset.poemId = poem.id
  if (prominent) button.classList.add('marker-prominent')
  button.setAttribute('aria-label', `查看${poem.author}《${poem.title}》`)
  button.style.setProperty('--poem-accent', poem.accent)

  const stem = document.createElement('span')
  stem.className = 'marker-stem'
  const label = document.createElement('span')
  label.className = 'marker-place-label'
  label.textContent = poem.placeName
  button.append(stem, label)
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect(poem)
  })

  return { button, marker: new Marker({ element: button, anchor: 'bottom' }) }
}

function createVerticalVerseMarker(poem: Poem) {
  const element = document.createElement('div')
  element.className = 'map-poem-sign'
  element.setAttribute('aria-hidden', 'true')

  const heading = document.createElement('strong')
  heading.textContent = poem.title
  const author = document.createElement('span')
  author.textContent = poem.author
  const place = document.createElement('small')
  place.textContent = poem.placeName
  element.append(heading, author, place)
  return new Marker({ element, anchor: 'bottom-left', offset: [16, -12] })
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
  const horizontalOffset = -Math.min(230, window.innerWidth * 0.16)

  map.easeTo({
    center: [poem.longitude, poem.latitude],
    zoom: compact ? 4.55 : 4.7,
    pitch: compact ? 54 : 60,
    bearing: -8,
    offset: compact ? [0, -145] : [horizontalOffset, 8],
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
      center: compact ? [101, 36.5] : [98, 37],
      zoom: compact ? 2.9 : 3.05,
      pitch: compact ? 40 : 42,
      bearing: -8,
      maxPitch: 78,
      minZoom: 2.4,
      maxZoom: 8,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    introInProgressRef.current = true

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: '唐代概念疆域：VerseCloud',
      }),
      'bottom-right',
    )
    window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector('.maplibregl-ctrl-attrib')
        ?.removeAttribute('open')
    })

    const markers: Marker[] = []
    const markerElements = new Map<string, HTMLButtonElement>()
    const compass = document.createElement('button')
    compass.type = 'button'
    compass.className = 'verse-compass'
    compass.setAttribute('aria-label', '归正地图方向')
    compass.innerHTML = '<span>南</span><i></i>'
    compass.addEventListener('click', () => {
      map.easeTo({ bearing: 0, pitch: compact ? 48 : 55, duration: 900 })
    })
    containerRef.current.append(compass)
    let focusFrame = 0
    const updateMarkerDensity = () => {
      containerRef.current?.classList.toggle('map-near', map.getZoom() >= 4.25)
    }
    const markSelected = (poemId: string) => {
      markerElements.forEach((element, id) => {
        element.classList.toggle('is-selected', id === poemId)
      })
    }
    const reportFocus = () => {
      if (focusFrame) return
      focusFrame = window.requestAnimationFrame(() => {
        const center = map.getCenter()
        onFocusRef.current(projectPoint(center.lng, center.lat))
        focusFrame = 0
      })
    }

    map.once('style.load', () => {
      map.setTerrain({ source: 'terrain', exaggeration: compact ? 1.25 : 1.5 })
      addHistoricalLayers(map, poems)
      applySeasonPalette(map, seasonRef.current)
      tangMapLabels.forEach((label) => {
        const marker = createHistoricalLabelMarker(label).addTo(map)
        markers.push(marker)
      })
      poems.forEach((poem, index) => {
        const prominent = index === 0 || index === 1 || index === 2 || poem.id === 'cui-hao-huanghelou'
        const { button, marker } = createPoemMarker(
          poem,
          prominent,
          (nextPoem) => onSelectRef.current(nextPoem),
        )
        marker.setLngLat([poem.longitude, poem.latitude]).addTo(map)
        markers.push(marker)
        markerElements.set(poem.id, button)
      })
      markSelected(selectedPoemRef.current.id)
      updateMarkerDensity()
      containerRef.current?.setAttribute('data-map-ready', 'true')
      reportFocus()
      window.requestAnimationFrame(() => {
        containerRef.current?.classList.add('map-intro-moving')
        map.easeTo({
          center: compact ? [108.4, 32.8] : [104.8, 34.6],
          zoom: compact ? 3.35 : 3.72,
          pitch: compact ? 53 : 60,
          bearing: -14,
          duration: 3_600,
          easing: (time) => 1 - Math.pow(1 - time, 3),
        })
        map.once('moveend', () => {
          introInProgressRef.current = false
          containerRef.current?.classList.remove('map-intro-moving')
          const pendingPoem = pendingFocusRef.current
          pendingFocusRef.current = null
          if (pendingPoem) focusSelectedPoem(map, pendingPoem)
        })
      })
    })
    map.on('move', reportFocus)
    map.on('zoom', updateMarkerDensity)

    return () => {
      if (focusFrame) window.cancelAnimationFrame(focusFrame)
      markers.forEach((marker) => marker.remove())
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
    if (source) source.setData(poemCollection(poems))
    containerRef.current
      ?.querySelectorAll<HTMLButtonElement>('.geographic-poem-marker')
      .forEach((element) => {
        element.classList.toggle('is-selected', element.dataset.poemId === selectedPoem.id)
      })

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

  return <div ref={containerRef} className="geographic-map" aria-label="三维唐代概念地形地图" />
}
