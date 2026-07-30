import { describe, expect, it } from 'vitest'
import { projectPoint } from './geo'
import { computeSoundscapeMix, soundscapeLabel } from './soundscape'

describe('computeSoundscapeMix', () => {
  it('normalizes the three regional weights', () => {
    const mix = computeSoundscapeMix({ x: 0, y: 0 })
    expect(mix.changan + mix.jiangnan + mix.frontier).toBeCloseTo(1, 8)
  })

  it('makes Jiangnan dominant when the camera centers on Suzhou', () => {
    const mix = computeSoundscapeMix(projectPoint(120.57, 31.31))
    expect(mix.dominant).toBe('jiangnan')
    expect(soundscapeLabel(mix)).toContain('江南')
  })

  it('makes the frontier layer dominant in the western corridor', () => {
    const mix = computeSoundscapeMix(projectPoint(91.1, 40.2))
    expect(mix.dominant).toBe('frontier')
  })
})
