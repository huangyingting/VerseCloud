import { describe, expect, it } from 'vitest'
import { poems } from '../data/poems'
import { projectPoint } from './geo'
import {
  computeSoundscapeMix,
  poemSoundscapeLabel,
  poemSoundscapeProfile,
  soundscapeLabel,
} from './soundscape'

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

  it('covers every visual motif with a stable soundscape profile', () => {
    const labels = poems.map(poemSoundscapeLabel)
    const profiles = poems.map(poemSoundscapeProfile)
    const effects = new Set(poems.map((poem) => poem.visualEffect))
    expect(new Set(labels).size).toBe(effects.size)
    expect(new Set(profiles.map((profile) => JSON.stringify(profile))).size)
      .toBe(effects.size)
    expect(new Set(profiles.map((profile) => profile.bpm)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(profiles.map((profile) => profile.waveform))).toEqual(
      new Set(['sine', 'triangle', 'sawtooth', 'square']),
    )
  })
})
