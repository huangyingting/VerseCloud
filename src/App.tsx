import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { activeSnapshot, snapshots } from './data/mapSnapshots'
import { defaultPoem, poems } from './data/poems'
import {
  computeSoundscapeMix,
  soundscapeLabel,
  SoundscapeEngine,
} from './lib/soundscape'
import type { Poem, ScenePoint, Season, SoundscapeMix } from './types'

const initialFocus = { x: 0, y: 0 }
const seasons: Array<{ id: Season; label: string; note: string }> = [
  { id: 'spring', label: '春', note: '花色与新绿' },
  { id: 'summer', label: '夏', note: '苍翠与深水' },
  { id: 'autumn', label: '秋', note: '暖金与澄江' },
  { id: 'winter', label: '冬', note: '霜白与寒水' },
]
const VerseScene = lazy(() =>
  import('./components/VerseScene').then((module) => ({ default: module.VerseScene })),
)

export function App() {
  const [selectedPoem, setSelectedPoem] = useState(defaultPoem)
  const [entered, setEntered] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [season, setSeason] = useState<Season>('spring')
  const [mix, setMix] = useState<SoundscapeMix>(() =>
    computeSoundscapeMix(initialFocus),
  )
  const focusPoint = useRef<ScenePoint>(initialFocus)
  const engine = useRef<SoundscapeEngine | null>(null)

  const startExperience = async () => {
    setEntered(true)
    if (!engine.current) engine.current = new SoundscapeEngine()
    try {
      await engine.current.start(focusPoint.current)
      setSoundEnabled(true)
    } catch (error) {
      console.warn('Soundscape could not start; continuing silently.', error)
      setSoundEnabled(false)
    }
  }

  const handleFocusChange = useCallback((point: ScenePoint) => {
    focusPoint.current = point
    const nextMix = engine.current?.update(point) ?? computeSoundscapeMix(point)
    setMix((currentMix) => {
      const materiallyChanged =
        currentMix.dominant !== nextMix.dominant
        || Math.abs(currentMix.changan - nextMix.changan) > 0.025
        || Math.abs(currentMix.jiangnan - nextMix.jiangnan) > 0.025
        || Math.abs(currentMix.frontier - nextMix.frontier) > 0.025
      return materiallyChanged ? nextMix : currentMix
    })
  }, [])

  const selectPoem = useCallback((poem: Poem) => {
    setSelectedPoem(poem)
    engine.current?.playPoemCue(poem)
  }, [])

  const toggleMute = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    engine.current?.setMuted(nextMuted)
  }

  useEffect(() => {
    return () => {
      engine.current?.dispose()
    }
  }, [])

  return (
    <main className={`app-shell season-${season}`}>
      <div className="scene-layer">
        {entered && (
          <Suspense fallback={<div className="scene-loading">山河入卷中…</div>}>
            <VerseScene
              poems={poems}
              selectedPoem={selectedPoem}
              season={season}
              onSelectPoem={selectPoem}
              onFocusChange={handleFocusChange}
            />
          </Suspense>
        )}
      </div>

      <div className="vignette" aria-hidden="true" />
      <div className="season-atmosphere" aria-hidden="true" />
      <div className="paper-grain" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="诗云首页">
          <span className="brand-seal">诗</span>
          <span>
            <strong>诗云</strong>
            <small>VERSE CLOUD</small>
          </span>
        </a>

        <nav className="dynasty-nav" aria-label="朝代选择">
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              type="button"
              className={snapshot.status === 'published' ? 'active' : ''}
              disabled={snapshot.status === 'planned'}
              title={snapshot.note}
            >
              {snapshot.dynastyLabel}
              {snapshot.status === 'planned' && <span>待考</span>}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <div className="soundscape-status" aria-live="polite">
            <span className={soundEnabled && !muted ? 'sound-dot playing' : 'sound-dot'} />
            <span>
              <small>此刻音景</small>
              {soundEnabled ? soundscapeLabel(mix) : '静音游历'}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={toggleMute}
            disabled={!soundEnabled}
            aria-label={muted ? '打开声音' : '静音'}
          >
            {muted ? '静' : '音'}
          </button>
        </div>
      </header>

      <aside className="era-panel">
        <span className="era-kicker">时空坐标</span>
        <strong>{activeSnapshot.dynastyLabel}</strong>
        <div className="era-year">{activeSnapshot.year}</div>
        <p>{activeSnapshot.eraLabel}</p>
        <div className="timeline-track">
          <span />
        </div>
        <small>公元</small>
      </aside>

      <section className="map-legend" aria-label="地图说明">
        <span><i className="legend-dot poem" />诗词地点</span>
        <span><i className="legend-water sea" />海域 · 湖泊 · 江河分色</span>
        <span><i className="legend-line division" />唐代概念道界</span>
        <span><i className="legend-relief" />真实地形晕渲</span>
        <span><i className="legend-area" />概念疆域</span>
      </section>

      {entered && (
        <section className="season-switch" aria-label="四时场景">
          <span>四时</span>
          <div>
            {seasons.map((item) => (
              <button
                key={item.id}
                type="button"
                className={season === item.id ? 'active' : ''}
                aria-pressed={season === item.id}
                title={item.note}
                onClick={() => setSeason(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="interaction-hint">
        <span>拖动山河</span>
        <span>右键旋转</span>
        <span>滚轮远近</span>
        <span>点击诗光</span>
      </div>

      {entered && (
        <nav className="poem-access-list" aria-label="诗词地点快捷选择">
          {poems.map((poem) => (
            <button
              key={poem.id}
              type="button"
              data-poem-select={poem.id}
              onClick={() => selectPoem(poem)}
            >
              {poem.placeName} · {poem.author}《{poem.title}》
            </button>
          ))}
        </nav>
      )}

      <footer className="release-note">
        <span>山河卷 0.10.1</span>
        <p>{activeSnapshot.note} · 地图 © OpenFreeMap / OpenStreetMap</p>
      </footer>

      {!entered && (
        <section className="entry-gate" aria-labelledby="entry-title">
          <div className="gate-contour contour-one" />
          <div className="gate-contour contour-two" />
          <div className="gate-contour contour-three" />
          <div className="gate-content">
            <span className="gate-eyebrow">一卷山河 · 八处诗光</span>
            <h2 id="entry-title">
              诗行落在大地上，<br />声音随山河而流转。
            </h2>
            <p>
              从长安出发，循真实山脉与江河入梦。地图移动时，长安、江南与西域的程序化音景会自然交融。
            </p>
            <button type="button" className="enter-button" onClick={startExperience}>
              <span>展开诗卷</span>
              <i>开启声音与真实地形游历</i>
            </button>
            <small>建议佩戴耳机 · 进入后可随时静音</small>
          </div>
        </section>
      )}
    </main>
  )
}
