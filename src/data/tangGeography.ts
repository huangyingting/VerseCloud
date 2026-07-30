export interface HistoricalMapLabel {
  name: string
  longitude: number
  latitude: number
  kind: 'region' | 'prefecture'
  major?: boolean
}

// These labels and divisions form an intentionally lightweight, artistic
// reading layer for the 742 concept map. They are not scholarly GIS polygons.
export const tangMapLabels: HistoricalMapLabel[] = [
  { name: '陇右道', longitude: 101.7, latitude: 36.8, kind: 'region', major: true },
  { name: '关内道', longitude: 108.2, latitude: 36.1, kind: 'region', major: true },
  { name: '河东道', longitude: 112.1, latitude: 37.5, kind: 'region' },
  { name: '河北道', longitude: 116.1, latitude: 38.1, kind: 'region', major: true },
  { name: '河南道', longitude: 114.4, latitude: 34.6, kind: 'region', major: true },
  { name: '山南西道', longitude: 106.2, latitude: 32.4, kind: 'region' },
  { name: '山南东道', longitude: 111.2, latitude: 32.1, kind: 'region' },
  { name: '淮南道', longitude: 117.2, latitude: 32.2, kind: 'region' },
  { name: '剑南道', longitude: 103.2, latitude: 29.8, kind: 'region', major: true },
  { name: '江南西道', longitude: 114.7, latitude: 28.1, kind: 'region' },
  { name: '江南东道', longitude: 119.8, latitude: 28.9, kind: 'region', major: true },
  { name: '黔中道', longitude: 107.4, latitude: 27.4, kind: 'region' },
  { name: '岭南道', longitude: 112.3, latitude: 23.3, kind: 'region', major: true },
  { name: '凉州', longitude: 102.64, latitude: 37.93, kind: 'prefecture', major: true },
  { name: '幽州', longitude: 116.4, latitude: 39.9, kind: 'prefecture', major: true },
  { name: '并州', longitude: 112.55, latitude: 37.87, kind: 'prefecture' },
  { name: '长安', longitude: 108.94, latitude: 34.34, kind: 'prefecture', major: true },
  { name: '洛阳', longitude: 112.45, latitude: 34.62, kind: 'prefecture', major: true },
  { name: '益州', longitude: 104.06, latitude: 30.67, kind: 'prefecture', major: true },
  { name: '襄州', longitude: 112.14, latitude: 32.04, kind: 'prefecture' },
  { name: '荆州', longitude: 112.24, latitude: 30.33, kind: 'prefecture' },
  { name: '扬州', longitude: 119.42, latitude: 32.39, kind: 'prefecture', major: true },
  { name: '苏州', longitude: 120.62, latitude: 31.32, kind: 'prefecture', major: true },
  { name: '杭州', longitude: 120.16, latitude: 30.25, kind: 'prefecture' },
  { name: '洪州', longitude: 115.85, latitude: 28.68, kind: 'prefecture' },
  { name: '泉州', longitude: 118.67, latitude: 24.88, kind: 'prefecture' },
  { name: '广州', longitude: 113.26, latitude: 23.13, kind: 'prefecture', major: true },
]

export const tangRegionDivisions: GeoJSON.FeatureCollection<GeoJSON.MultiLineString> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { interpretation: 'artistic', name: '盛唐概念道界' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[103.4, 39.8], [105.6, 36.8], [106.2, 33.4]],
          [[109.4, 40.6], [110.6, 37.1], [111.3, 34.7]],
          [[114.2, 41.0], [113.8, 37.6], [113.0, 35.0]],
          [[106.0, 34.0], [110.1, 33.5], [114.1, 34.2], [118.3, 34.5]],
          [[103.5, 32.4], [107.6, 31.6], [112.0, 31.1], [116.7, 31.4]],
          [[106.0, 29.4], [109.4, 28.8], [113.4, 27.0]],
          [[112.0, 31.0], [115.8, 29.8], [120.5, 29.7]],
          [[114.0, 27.0], [117.2, 26.2], [120.3, 26.8]],
          [[108.0, 25.6], [111.5, 24.6], [114.7, 22.6]],
        ],
      },
    },
  ],
}
