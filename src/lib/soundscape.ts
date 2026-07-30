import type { Gain, Loop, PolySynth, Reverb } from 'tone'
import type { Poem, ScenePoint, SoundscapeMix } from '../types'
import { projectPoint } from './geo'

const anchors = {
  changan: projectPoint(108.94, 34.34),
  jiangnan: projectPoint(120.3, 30.7),
  frontier: projectPoint(91.1, 40.2),
}

function squaredDistance(a: ScenePoint, b: ScenePoint) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

export function computeSoundscapeMix(point: ScenePoint): SoundscapeMix {
  const raw = {
    changan: 1 / (2.4 + squaredDistance(point, anchors.changan)),
    jiangnan: 1 / (2.4 + squaredDistance(point, anchors.jiangnan)),
    frontier: 1 / (2.4 + squaredDistance(point, anchors.frontier)),
  }
  const total = raw.changan + raw.jiangnan + raw.frontier
  const normalized = {
    changan: raw.changan / total,
    jiangnan: raw.jiangnan / total,
    frontier: raw.frontier / total,
  }
  const dominant = (Object.entries(normalized).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? 'changan') as SoundscapeMix['dominant']

  return { ...normalized, dominant }
}

const zoneLabels: Record<SoundscapeMix['dominant'], string> = {
  changan: '长安 · 宫商余韵',
  jiangnan: '江南 · 烟水清音',
  frontier: '西域 · 长风驼铃',
}

export function soundscapeLabel(mix: SoundscapeMix) {
  return zoneLabels[mix.dominant]
}

export class SoundscapeEngine {
  private started = false
  private tone: typeof import('tone') | null = null
  private loops: Loop[] = []
  private gains: Partial<Record<keyof typeof anchors, Gain>> = {}
  private synths: PolySynth[] = []
  private cueSynth: PolySynth | null = null
  private reverb: Reverb | null = null
  private noteIndices = { changan: 0, jiangnan: 0, frontier: 0 }

  async start(initialPoint: ScenePoint) {
    if (this.started) return
    const Tone = await import('tone')
    this.tone = Tone
    await Tone.start()

    const reverb = new Tone.Reverb({ decay: 4.8, wet: 0.34 }).toDestination()
    await reverb.generate()
    this.reverb = reverb

    const zoneConfigs = {
      changan: {
        notes: ['D4', 'A3', 'C4', 'G3', 'D4'],
        interval: '2n',
        type: 'sine' as const,
      },
      jiangnan: {
        notes: ['A4', 'E4', 'G4', 'D4', 'A4', 'C5'],
        interval: '2n.',
        type: 'triangle' as const,
      },
      frontier: {
        notes: ['D3', 'G3', 'A3', 'C4', 'A3'],
        interval: '1m',
        type: 'sine' as const,
      },
    }

    for (const zone of Object.keys(zoneConfigs) as Array<keyof typeof zoneConfigs>) {
      const gain = new Tone.Gain(0).connect(reverb)
      const config = zoneConfigs[zone]
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: config.type },
        envelope: {
          attack: zone === 'frontier' ? 1.2 : 0.06,
          decay: 1.1,
          sustain: 0.12,
          release: zone === 'frontier' ? 4.5 : 2.8,
        },
        volume: zone === 'frontier' ? -14 : -17,
      }).connect(gain)
      const loop = new Tone.Loop((time) => {
        const index = this.noteIndices[zone]
        synth.triggerAttackRelease(config.notes[index % config.notes.length], '2n', time)
        this.noteIndices[zone] += 1
      }, config.interval)

      this.gains[zone] = gain
      this.synths.push(synth)
      this.loops.push(loop)
      loop.start(zone === 'jiangnan' ? '4n' : 0)
    }

    this.cueSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 1.6 },
      volume: -13,
    }).connect(reverb)

    const transport = Tone.getTransport()
    transport.bpm.value = 56
    transport.start()
    this.started = true
    this.update(initialPoint, true)
  }

  update(point: ScenePoint, immediate = false) {
    if (!this.started) return computeSoundscapeMix(point)
    const mix = computeSoundscapeMix(point)
    const duration = immediate ? 0.05 : 2.4
    this.gains.changan?.gain.rampTo(mix.changan * 0.58, duration)
    this.gains.jiangnan?.gain.rampTo(mix.jiangnan * 0.58, duration)
    this.gains.frontier?.gain.rampTo(mix.frontier * 0.5, duration)
    return mix
  }

  playPoemCue(poem: Poem) {
    if (!this.started || !this.cueSynth || !this.tone) return
    const palettes = [
      ['D5', 'A4', 'E5'],
      ['A4', 'C5', 'G5'],
      ['G4', 'D5', 'A5'],
    ]
    const charSum = [...poem.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
    const notes = palettes[charSum % palettes.length]
    const now = this.tone.now()
    notes.forEach((note, index) => {
      this.cueSynth?.triggerAttackRelease(note, '8n', now + index * 0.18, 0.45)
    })
  }

  setMuted(muted: boolean) {
    if (this.tone) this.tone.getDestination().mute = muted
  }

  dispose() {
    if (!this.started) return
    this.loops.forEach((loop) => loop.dispose())
    this.synths.forEach((synth) => synth.dispose())
    Object.values(this.gains).forEach((gain) => gain?.dispose())
    this.cueSynth?.dispose()
    this.reverb?.dispose()
    this.tone?.getTransport().stop()
    this.tone = null
    this.started = false
  }
}
