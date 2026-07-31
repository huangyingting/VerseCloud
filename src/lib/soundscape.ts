import type { Gain, Loop, Oscillator, Reverb } from 'tone'
import type { Poem, PoemVisualEffect, ScenePoint, SoundscapeMix } from '../types'
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

type PoemScore = {
  label: string
  steps: Array<string | string[] | null>
  duration: '8n' | '4n' | '2n'
  level: number
}

const poemScores: Record<PoemVisualEffect, PoemScore> = {
  'petals-embers': {
    label: '残春烽火',
    steps: ['D4', ['F4', 'A4'], null, 'C5', 'A4', null, ['D4', 'G4'], 'E4'],
    duration: '4n',
    level: 0.68,
  },
  'river-flight': {
    label: '彩云轻舟',
    steps: ['A4', 'D5', 'E5', 'A5', 'G5', 'E5', 'D5', 'A4'],
    duration: '8n',
    level: 0.62,
  },
  'moon-fire': {
    label: '霜夜渔火',
    steps: [['A3', 'E4'], null, 'G4', null, 'D4', null, ['C4', 'A4'], null],
    duration: '2n',
    level: 0.6,
  },
  'river-mist': {
    label: '烟渚近月',
    steps: ['D4', null, 'A3', 'E4', null, 'G4', null, 'D4'],
    duration: '2n',
    level: 0.56,
  },
  'sun-river': {
    label: '白日层楼',
    steps: ['D3', 'A3', 'D4', ['F4', 'A4'], 'G4', 'A4', ['D4', 'D5'], null],
    duration: '4n',
    level: 0.66,
  },
  'cloud-crane': {
    label: '黄鹤入云',
    steps: ['G4', 'D5', null, 'A5', 'G5', null, 'E5', 'D5'],
    duration: '4n',
    level: 0.59,
  },
  waterfall: {
    label: '银河飞瀑',
    steps: ['A5', 'E5', 'D5', 'A4', 'G4', 'E4', 'D4', ['A3', 'D4']],
    duration: '8n',
    level: 0.64,
  },
  'morning-rain': {
    label: '渭城朝雨',
    steps: [['D4', 'A4'], null, 'E4', 'G4', null, 'A4', 'E4', null],
    duration: '4n',
    level: 0.57,
  },
}

export function poemSoundscapeLabel(poem: Poem) {
  return poemScores[poem.visualEffect].label
}

type PoemDeck = {
  gain: Gain
  voices: FixedVoice[]
  loop: Loop
  steps: PoemScore['steps']
  duration: PoemScore['duration']
  noteIndex: number
  active: boolean
}

type FixedVoice = {
  oscillator: Oscillator
  gain: Gain
}

export class SoundscapeEngine {
  private started = false
  private tone: typeof import('tone') | null = null
  private loops: Loop[] = []
  private gains: Partial<Record<keyof typeof anchors, Gain>> = {}
  private voices: FixedVoice[] = []
  private cueVoices: FixedVoice[] = []
  private reverb: Reverb | null = null
  private noteIndices = { changan: 0, jiangnan: 0, frontier: 0 }
  private poemDecks: PoemDeck[] = []
  private activePoemDeck = -1
  private currentMix: SoundscapeMix | null = null
  private muted = false

  private createVoices(
    count: number,
    type: 'sine' | 'triangle',
    output: Gain | Reverb,
  ) {
    if (!this.tone) return []
    const Tone = this.tone
    return Array.from({ length: count }, () => {
      const gain = new Tone.Gain(0).connect(output)
      // The oscillator is started exactly once and remains silent behind its
      // gain node between notes. Pitch and amplitude automation are reused,
      // so long sessions do not allocate a new Web Audio graph per note.
      const oscillator = new Tone.Oscillator({ frequency: 220, type })
        .connect(gain)
        .start()
      const voice = { oscillator, gain }
      this.voices.push(voice)
      return voice
    })
  }

  private triggerVoice(
    voice: FixedVoice,
    note: string,
    duration: PoemScore['duration'] | '2n',
    time: number,
    velocity: number,
    attack: number,
    release: number,
  ) {
    if (!this.tone) return
    const frequency = this.tone.Frequency(note).toFrequency()
    const durationSeconds = this.tone.Time(duration).toSeconds()
    const effectiveAttack = Math.min(attack, Math.max(0.015, durationSeconds * 0.45))
    const resetTime = time + 0.012
    const peakTime = resetTime + effectiveAttack
    const releaseTime = time + durationSeconds + release
    const gain = voice.gain.gain

    gain.cancelAndHoldAtTime(time)
    gain.linearRampToValueAtTime(0, resetTime)
    voice.oscillator.frequency.setValueAtTime(frequency, resetTime)
    gain.linearRampToValueAtTime(velocity, peakTime)
    gain.linearRampToValueAtTime(velocity * 0.42, time + durationSeconds)
    gain.linearRampToValueAtTime(0, releaseTime)
  }

  private triggerVoices(
    voices: FixedVoice[],
    notes: string | string[],
    duration: PoemScore['duration'] | '2n',
    time: number,
    velocity: number,
    attack: number,
    release: number,
  ) {
    const noteList = Array.isArray(notes) ? notes : [notes]
    const adjustedVelocity = velocity / Math.sqrt(noteList.length)
    noteList.slice(0, voices.length).forEach((note, index) => {
      this.triggerVoice(
        voices[index],
        note,
        duration,
        time,
        adjustedVelocity,
        attack,
        release,
      )
    })
  }

  async start(initialPoint: ScenePoint, initialPoem: Poem) {
    if (this.started) return
    const Tone = await import('tone')
    this.tone = Tone
    await Tone.start()
    this.currentMix = computeSoundscapeMix(initialPoint)

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
      const voices = this.createVoices(1, config.type, gain)
      const loop = new Tone.Loop((time) => {
        if ((this.currentMix?.[zone] ?? 0) < 0.025) return
        const index = this.noteIndices[zone]
        this.triggerVoices(
          voices,
          config.notes[index % config.notes.length],
          '2n',
          time,
          zone === 'frontier' ? 0.24 : 0.18,
          zone === 'frontier' ? 0.7 : 0.05,
          zone === 'frontier' ? 2.4 : 1.4,
        )
        this.noteIndices[zone] += 1
      }, config.interval)

      this.gains[zone] = gain
      this.loops.push(loop)
      loop.start(zone === 'jiangnan' ? '4n' : 0)
    }

    // Two continuously scheduled decks let a newly selected poem fade in
    // while the previous score remains audible long enough to fade out.
    for (let deckIndex = 0; deckIndex < 2; deckIndex += 1) {
      const gain = new Tone.Gain(0).connect(reverb)
      const voices = this.createVoices(
        2,
        deckIndex === 0 ? 'triangle' : 'sine',
        gain,
      )
      let deck: PoemDeck
      const loop = new Tone.Loop((time) => {
        if (!deck.active) return
        const step = deck.steps[deck.noteIndex % deck.steps.length]
        if (step) {
          this.triggerVoices(
            deck.voices,
            step,
            deck.duration,
            time,
            0.16,
            deckIndex === 0 ? 0.06 : 0.28,
            deckIndex === 0 ? 1.25 : 2.1,
          )
        }
        deck.noteIndex += 1
      }, '4n')
      deck = {
        gain,
        voices,
        loop,
        steps: [null],
        duration: '4n',
        noteIndex: 0,
        active: false,
      }
      this.poemDecks.push(deck)
      this.loops.push(loop)
      loop.start(deckIndex === 0 ? 0 : '8n')
    }

    this.cueVoices = this.createVoices(3, 'sine', reverb)

    const transport = Tone.getTransport()
    transport.bpm.value = 56
    transport.start()
    this.started = true
    this.update(initialPoint, true)
    this.transitionToPoem(initialPoem, true)
  }

  update(point: ScenePoint, immediate = false) {
    if (!this.started) return computeSoundscapeMix(point)
    const mix = computeSoundscapeMix(point)
    this.currentMix = mix
    const duration = immediate ? 0.05 : 2.4
    this.gains.changan?.gain.rampTo(mix.changan * 0.32, duration)
    this.gains.jiangnan?.gain.rampTo(mix.jiangnan * 0.32, duration)
    this.gains.frontier?.gain.rampTo(mix.frontier * 0.28, duration)
    return mix
  }

  transitionToPoem(poem: Poem, immediate = false) {
    if (!this.started || this.poemDecks.length < 2) return
    const score = poemScores[poem.visualEffect]
    const nextDeckIndex = this.activePoemDeck === 0 ? 1 : 0
    const nextDeck = this.poemDecks[nextDeckIndex]
    const previousDeck = this.activePoemDeck >= 0
      ? this.poemDecks[this.activePoemDeck]
      : null
    const fadeDuration = immediate ? 0.08 : 1.8

    nextDeck.voices.forEach((voice) => voice.gain.gain.rampTo(0, 0.04))
    nextDeck.steps = score.steps
    nextDeck.duration = score.duration
    nextDeck.noteIndex = 0
    nextDeck.active = true
    if (previousDeck) previousDeck.active = false
    nextDeck.gain.gain.rampTo(score.level, fadeDuration)
    previousDeck?.gain.gain.rampTo(0, fadeDuration)
    this.activePoemDeck = nextDeckIndex
  }

  playPoemCue(poem: Poem) {
    if (!this.started || this.muted || !this.tone) return
    const palettes = [
      ['D5', 'A4', 'E5'],
      ['A4', 'C5', 'G5'],
      ['G4', 'D5', 'A5'],
    ]
    const charSum = [...poem.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
    const notes = palettes[charSum % palettes.length]
    const now = this.tone.now()
    notes.forEach((note, index) => {
      const voice = this.cueVoices[index]
      if (voice) {
        this.triggerVoice(voice, note, '8n', now + index * 0.18, 0.1, 0.01, 0.65)
      }
    })
  }

  setMuted(muted: boolean) {
    if (!this.tone || this.muted === muted) return
    this.muted = muted
    const Tone = this.tone
    const transport = Tone.getTransport()
    Tone.getDestination().mute = muted

    if (muted) {
      transport.pause()
      const now = Tone.immediate()
      this.voices.forEach((voice) => {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(0, now)
      })
      const rawContext = Tone.getContext().rawContext
      if ('resume' in rawContext) {
        void (rawContext as AudioContext).suspend()
      }
      return
    }

    void Tone.getContext().resume().then(() => {
      if (!this.muted && this.started) transport.start()
    })
  }

  dispose() {
    if (!this.started) return
    this.loops.forEach((loop) => loop.dispose())
    this.voices.forEach((voice) => {
      voice.oscillator.dispose()
      voice.gain.dispose()
    })
    Object.values(this.gains).forEach((gain) => gain?.dispose())
    this.poemDecks.forEach((deck) => deck.gain.dispose())
    this.reverb?.dispose()
    this.tone?.getTransport().stop()
    this.poemDecks = []
    this.voices = []
    this.cueVoices = []
    this.activePoemDeck = -1
    this.currentMix = null
    this.muted = false
    this.tone = null
    this.started = false
  }
}
