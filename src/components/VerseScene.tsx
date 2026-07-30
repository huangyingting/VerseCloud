import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { activeSnapshot } from '../data/mapSnapshots'
import { projectPoint } from '../lib/geo'
import type { Poem, ScenePoint } from '../types'

interface VerseSceneProps {
  poems: Poem[]
  selectedPoem: Poem
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
        'raster-opacity': 0.78,
        'raster-saturation': -0.72,
        'raster-contrast': 0.32,
        'raster-brightness-min': 0.05,
        'raster-brightness-max': 0.42,
        'raster-hue-rotate': 28,
      },
    },
    {
      id: 'terrain-hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-shadow-color': '#040a07',
        'hillshade-highlight-color': '#b5a37b',
        'hillshade-accent-color': '#4f5e4c',
        'hillshade-exaggeration': 0.72,
        'hillshade-illumination-direction': 318,
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {
        'fill-color': '#0b292b',
        'fill-opacity': 0.82,
      },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      filter: ['in', 'class', 'river', 'canal'],
      paint: {
        'line-color': '#6ba2a0',
        'line-opacity': 0.58,
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
      'fill-opacity': 0.16,
    },
  })
  map.addLayer({
    id: 'tang-outer-glow',
    type: 'line',
    source: 'tang-boundary',
    paint: {
      'line-color': '#1a1208',
      'line-opacity': 0.72,
      'line-width': 6,
      'line-blur': 4,
    },
  })
  map.addLayer({
    id: 'tang-line',
    type: 'line',
    source: 'tang-boundary',
    paint: {
      'line-color': '#e0c17c',
      'line-opacity': 0.84,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2.8],
      'line-dasharray': [2, 1.3],
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
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 8, 7, 14],
      'circle-color': ['get', 'accent'],
      'circle-opacity': 0.12,
      'circle-blur': 0.65,
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: 'poem-points',
    type: 'circle',
    source: 'poems',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 7, 7],
      'circle-color': ['get', 'accent'],
      'circle-stroke-color': '#f4e7c9',
      'circle-stroke-width': 1.2,
      'circle-opacity': 0.94,
      'circle-pitch-alignment': 'map',
    },
  })
}

function createPoemMarker(poem: Poem, onSelect: (poem: Poem) => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'geographic-poem-marker'
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
  element.className = 'map-vertical-verse'
  element.setAttribute('aria-hidden', 'true')

  const heading = document.createElement('strong')
  heading.textContent = poem.title
  const author = document.createElement('span')
  author.textContent = poem.author
  const verse = document.createElement('div')
  verse.className = 'map-vertical-lines'
  poem.lines.slice(0, 4).forEach((line) => {
    const column = document.createElement('p')
    column.textContent = line
    verse.append(column)
  })
  element.append(heading, author, verse)
  return new Marker({ element, anchor: 'bottom-left', offset: [18, -18] })
}

export function VerseScene({
  poems,
  selectedPoem,
  onSelectPoem,
  onFocusChange,
}: VerseSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const selectedMarkerRef = useRef<Marker | null>(null)
  const onSelectRef = useRef(onSelectPoem)
  const onFocusRef = useRef(onFocusChange)

  useEffect(() => {
    onSelectRef.current = onSelectPoem
  }, [onSelectPoem])

  useEffect(() => {
    onFocusRef.current = onFocusChange
  }, [onFocusChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const compact = window.matchMedia('(max-width: 680px)').matches
    const map = new MapLibreMap({
      container: containerRef.current,
      style: geographicStyle,
      center: compact ? [108.2, 33.2] : [105.5, 34.8],
      zoom: compact ? 3.25 : 3.65,
      pitch: compact ? 54 : 60,
      bearing: -16,
      maxPitch: 78,
      minZoom: 2.4,
      maxZoom: 8,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map

    map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-left')
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: '唐代概念疆域：VerseCloud',
      }),
      'bottom-right',
    )

    const markers: Marker[] = []
    let focusFrame = 0
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
      poems.forEach((poem) => {
        const { marker } = createPoemMarker(poem, (nextPoem) => onSelectRef.current(nextPoem))
        marker.setLngLat([poem.longitude, poem.latitude]).addTo(map)
        markers.push(marker)
      })
      containerRef.current?.setAttribute('data-map-ready', 'true')
      reportFocus()
    })
    map.on('move', reportFocus)

    return () => {
      if (focusFrame) window.cancelAnimationFrame(focusFrame)
      markers.forEach((marker) => marker.remove())
      selectedMarkerRef.current?.remove()
      selectedMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [poems])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    selectedMarkerRef.current?.remove()
    selectedMarkerRef.current = createVerticalVerseMarker(selectedPoem)
      .setLngLat([selectedPoem.longitude, selectedPoem.latitude])
      .addTo(map)

    const source = map.getSource('poems') as GeoJSONSource | undefined
    if (source) source.setData(poemCollection(poems))
  }, [poems, selectedPoem])

  return <div ref={containerRef} className="geographic-map" aria-label="三维唐代概念地形地图" />
}
