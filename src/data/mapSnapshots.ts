import type { MapSnapshot } from '../types'

// VerseCloud uses an intentionally hand-authored silhouette as its published
// artistic interpretation of the Tang realm. It communicates a poetic spatial
// impression rather than claiming to be a scholarly border reconstruction.
const tangPrototypeBoundary: number[][][][] = [
  [
    [
      [73.5, 39.2],
      [78, 43.2],
      [84.5, 46.5],
      [91.5, 47.6],
      [99, 45.8],
      [105.5, 43.8],
      [113, 44.9],
      [120.4, 42.4],
      [123.8, 38.8],
      [121.5, 34.2],
      [121.2, 29.5],
      [117.8, 24.2],
      [111.2, 20.8],
      [105.2, 22.3],
      [100.2, 25.4],
      [96.4, 28.4],
      [91.4, 29.8],
      [86, 33.2],
      [80, 35.1],
      [73.5, 39.2],
    ],
  ],
]

export const snapshots: MapSnapshot[] = [
  {
    id: 'tang-742-concept',
    dynasty: 'tang',
    dynastyLabel: '唐',
    eraLabel: '天宝元年',
    year: 742,
    status: 'published',
    note: '盛唐概念疆域 · 艺术化空间演绎',
    boundary: tangPrototypeBoundary,
  },
  {
    id: 'song-1080-planned',
    dynasty: 'song',
    dynastyLabel: '宋',
    eraLabel: '元丰三年',
    year: 1080,
    status: 'planned',
    note: '宋代概念疆域绘制中。',
  },
  {
    id: 'yuan-1280-planned',
    dynasty: 'yuan',
    dynastyLabel: '元',
    eraLabel: '至元十七年',
    year: 1280,
    status: 'planned',
    note: '元代概念疆域绘制中。',
  },
  {
    id: 'ming-1391-planned',
    dynasty: 'ming',
    dynastyLabel: '明',
    eraLabel: '洪武二十四年',
    year: 1391,
    status: 'planned',
    note: '明代概念疆域绘制中。',
  },
]

export const activeSnapshot = snapshots[0]
