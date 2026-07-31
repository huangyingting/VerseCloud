import type {
  FeedbackDelay,
  Filter,
  Gain,
  Loop,
  Oscillator,
  Reverb,
} from 'tone'
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
  subdivision: '8n' | '4n' | '2n'
  duration: '8n' | '4n' | '2n'
  bpm: number
  waveform: 'sine' | 'triangle' | 'sawtooth' | 'square'
  filterFrequency: number
  filterQ: number
  attack: number
  release: number
  velocity: number
  delayTime: '8n' | '4n' | '2n'
  delayWet: number
  delayFeedback: number
  level: number
}

const poemScores: Record<PoemVisualEffect, PoemScore> = {
  'petals-embers': {
    label: '残春烽火',
    steps: ['D4', ['F4', 'A4'], null, 'C5', 'A4', null, ['D4', 'G4'], 'E4'],
    subdivision: '4n',
    duration: '4n',
    bpm: 52,
    waveform: 'triangle',
    filterFrequency: 950,
    filterQ: 0.9,
    attack: 0.12,
    release: 1.5,
    velocity: 0.15,
    delayTime: '4n',
    delayWet: 0.08,
    delayFeedback: 0.12,
    level: 0.66,
  },
  'river-flight': {
    label: '彩云轻舟',
    steps: [
      'E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'G#5', 'B5',
      'G#5', 'E5', 'C#5', 'B4', 'G#4', 'F#4', 'E4', null,
    ],
    subdivision: '8n',
    duration: '8n',
    bpm: 88,
    waveform: 'sawtooth',
    filterFrequency: 4200,
    filterQ: 1.8,
    attack: 0.018,
    release: 0.32,
    velocity: 0.1,
    delayTime: '8n',
    delayWet: 0.17,
    delayFeedback: 0.2,
    level: 0.58,
  },
  'moon-fire': {
    label: '霜夜渔火',
    steps: [['A3', 'E4'], null, null, 'C4', null, 'G3', null, ['D4', 'A4']],
    subdivision: '2n',
    duration: '2n',
    bpm: 42,
    waveform: 'sine',
    filterFrequency: 1150,
    filterQ: 0.55,
    attack: 0.46,
    release: 3.1,
    velocity: 0.13,
    delayTime: '2n',
    delayWet: 0.26,
    delayFeedback: 0.32,
    level: 0.6,
  },
  'river-mist': {
    label: '烟渚近月',
    steps: ['G3', null, 'D4', null, ['A3', 'E4'], 'C4', null, 'G4'],
    subdivision: '4n',
    duration: '4n',
    bpm: 48,
    waveform: 'sine',
    filterFrequency: 680,
    filterQ: 0.35,
    attack: 0.72,
    release: 2.6,
    velocity: 0.14,
    delayTime: '4n',
    delayWet: 0.12,
    delayFeedback: 0.18,
    level: 0.56,
  },
  'sun-river': {
    label: '白日层楼',
    steps: ['C3', 'G3', 'C4', 'D4', 'E4', 'G4', 'A4', ['C4', 'C5']],
    subdivision: '4n',
    duration: '4n',
    bpm: 66,
    waveform: 'square',
    filterFrequency: 1550,
    filterQ: 2.1,
    attack: 0.025,
    release: 0.9,
    velocity: 0.085,
    delayTime: '8n',
    delayWet: 0.05,
    delayFeedback: 0.08,
    level: 0.57,
  },
  'cloud-crane': {
    label: '黄鹤入云',
    steps: ['B3', 'F#4', null, 'D5', 'E5', null, 'A5', 'F#5'],
    subdivision: '4n',
    duration: '4n',
    bpm: 58,
    waveform: 'triangle',
    filterFrequency: 2850,
    filterQ: 1.15,
    attack: 0.24,
    release: 2.4,
    velocity: 0.13,
    delayTime: '4n',
    delayWet: 0.23,
    delayFeedback: 0.27,
    level: 0.59,
  },
  waterfall: {
    label: '银河飞瀑',
    steps: [
      'B6', 'G6', 'E6', 'D6', 'B5', 'G5', 'E5', 'D5',
      'B4', 'G4', 'E4', 'D4', ['E4', 'B4'], null, 'B5', 'E6',
    ],
    subdivision: '8n',
    duration: '8n',
    bpm: 94,
    waveform: 'sawtooth',
    filterFrequency: 5200,
    filterQ: 1.65,
    attack: 0.012,
    release: 0.42,
    velocity: 0.085,
    delayTime: '8n',
    delayWet: 0.14,
    delayFeedback: 0.16,
    level: 0.56,
  },
  'morning-rain': {
    label: '渭城朝雨',
    steps: [
      'F4', null, 'A4', 'G4', null, 'C5', 'A4', null,
      'D5', 'C5', null, 'A4', 'G4', null, ['F4', 'C5'], null,
    ],
    subdivision: '8n',
    duration: '8n',
    bpm: 60,
    waveform: 'triangle',
    filterFrequency: 2050,
    filterQ: 1.45,
    attack: 0.035,
    release: 0.75,
    velocity: 0.12,
    delayTime: '8n',
    delayWet: 0.27,
    delayFeedback: 0.36,
    level: 0.58,
  },
}

export function poemSoundscapeLabel(poem: Poem) {
  return poemScores[poem.visualEffect].label
}

export function poemSoundscapeProfile(poem: Poem) {
  const score = poemScores[poem.visualEffect]
  return {
    bpm: score.bpm,
    subdivision: score.subdivision,
    waveform: score.waveform,
    filterFrequency: score.filterFrequency,
  }
}

type PoemDeck = {
  gain: Gain
  filter: Filter
  delay: FeedbackDelay
  voices: FixedVoice[]
  loop: Loop
  score: PoemScore | null
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
    type: PoemScore['waveform'],
    output: Gain | Reverb | Filter,
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

    const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.2 }).toDestination()
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
      const delay = new Tone.FeedbackDelay({
        delayTime: '8n',
        maxDelay: 3,
        feedback: 0.1,
        wet: 0,
      }).connect(gain)
      const filter = new Tone.Filter({
        frequency: 1800,
        type: 'lowpass',
        Q: 1,
        rolloff: -12,
      }).connect(delay)
      const voices = this.createVoices(2, 'sine', filter)
      let deck: PoemDeck
      const loop = new Tone.Loop((time) => {
        const score = deck.score
        if (!deck.active || !score) return
        const step = score.steps[deck.noteIndex % score.steps.length]
        if (step) {
          this.triggerVoices(
            deck.voices,
            step,
            score.duration,
            time,
            score.velocity,
            score.attack,
            score.release,
          )
        }
        deck.noteIndex += 1
      }, '4n')
      deck = {
        gain,
        filter,
        delay,
        voices,
        loop,
        score: null,
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
    this.gains.changan?.gain.rampTo(mix.changan * 0.2, duration)
    this.gains.jiangnan?.gain.rampTo(mix.jiangnan * 0.2, duration)
    this.gains.frontier?.gain.rampTo(mix.frontier * 0.18, duration)
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
    nextDeck.score = score
    nextDeck.noteIndex = 0
    nextDeck.active = true
    if (previousDeck) previousDeck.active = false
    nextDeck.loop.interval = score.subdivision
    nextDeck.voices.forEach((voice) => {
      voice.oscillator.type = score.waveform
    })
    nextDeck.filter.frequency.rampTo(score.filterFrequency, fadeDuration)
    nextDeck.filter.Q.rampTo(score.filterQ, fadeDuration)
    nextDeck.delay.delayTime.rampTo(
      this.tone?.Time(score.delayTime).toSeconds() ?? 0.25,
      fadeDuration,
    )
    nextDeck.delay.wet.rampTo(score.delayWet, fadeDuration)
    nextDeck.delay.feedback.rampTo(score.delayFeedback, fadeDuration)
    nextDeck.gain.gain.rampTo(score.level, fadeDuration)
    previousDeck?.gain.gain.rampTo(0, fadeDuration)
    this.tone?.getTransport().bpm.rampTo(score.bpm, fadeDuration)
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
    this.poemDecks.forEach((deck) => {
      deck.filter.dispose()
      deck.delay.dispose()
      deck.gain.dispose()
    })
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
