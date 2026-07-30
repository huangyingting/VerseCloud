import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { activeSnapshot, snapshots } from './data/mapSnapshots'
import {
  confidenceLabels,
  defaultPoem,
  poems,
  relationLabels,
} from './data/poems'
import {
  computeSoundscapeMix,
  soundscapeLabel,
  SoundscapeEngine,
} from './lib/soundscape'
import type { Poem, ScenePoint, SoundscapeMix } from './types'

const initialFocus = { x: 0, y: 0 }
const VerseScene = lazy(() =>
  import('./components/VerseScene').then((module) => ({ default: module.VerseScene })),
)

export function App() {
  const [selectedPoem, setSelectedPoem] = useState(defaultPoem)
  const [entered, setEntered] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [mix, setMix] = useState<SoundscapeMix>(() =>
    computeSoundscapeMix(initialFocus),
  )
  const [focusPoint, setFocusPoint] = useState<ScenePoint>(initialFocus)
  const engine = useRef<SoundscapeEngine | null>(null)

  const selectedIndex = useMemo(
    () => poems.findIndex((poem) => poem.id === selectedPoem.id),
    [selectedPoem.id],
  )

  const startExperience = async () => {
    setEntered(true)
    if (!engine.current) engine.current = new SoundscapeEngine()
    try {
      await engine.current.start(focusPoint)
      setSoundEnabled(true)
    } catch (error) {
      console.warn('Soundscape could not start; continuing silently.', error)
      setSoundEnabled(false)
    }
  }

  const handleFocusChange = useCallback((point: ScenePoint) => {
    setFocusPoint(point)
    const nextMix = engine.current?.update(point) ?? computeSoundscapeMix(point)
    setMix(nextMix)
  }, [])

  const selectPoem = useCallback((poem: Poem) => {
    setSelectedPoem(poem)
    setDetailsOpen(true)
    engine.current?.playPoemCue(poem)
  }, [])

  const moveSelection = (direction: -1 | 1) => {
    const nextIndex = (selectedIndex + direction + poems.length) % poems.length
    selectPoem(poems[nextIndex])
  }

  const toggleMute = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    engine.current?.setMuted(nextMuted)
  }

  useEffect(() => {
    return () => engine.current?.dispose()
  }, [])

  return (
    <main className="app-shell">
      <div className="scene-layer" aria-hidden="true">
        {entered && (
          <Suspense fallback={<div className="scene-loading">山河入卷中…</div>}>
            <VerseScene
              poems={poems}
              selectedPoem={selectedPoem}
              onSelectPoem={selectPoem}
              onFocusChange={handleFocusChange}
            />
          </Suspense>
        )}
      </div>

      <div className="vignette" aria-hidden="true" />
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
        <span><i className="legend-line river" />江河意象</span>
        <span><i className="legend-area" />概念疆域</span>
      </section>

      <div className="interaction-hint">
        <span>拖动游历</span>
        <span>滚轮远近</span>
        <span>点击诗光</span>
      </div>

      <section className={`poem-card ${detailsOpen ? 'open' : 'collapsed'}`}>
        <button
          type="button"
          className="card-toggle"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? '收起诗词详情' : '展开诗词详情'}
        >
          {detailsOpen ? '收' : '展'}
        </button>

        <div className="poem-heading">
          <div>
            <span className="place-chip">{selectedPoem.placeName}</span>
            <h1>{selectedPoem.title}</h1>
            <p>〔唐〕{selectedPoem.author}</p>
          </div>
          <span className="poem-count">
            {String(selectedIndex + 1).padStart(2, '0')}
            <small>/ {String(poems.length).padStart(2, '0')}</small>
          </span>
        </div>

        <div className="poem-lines">
          {selectedPoem.lines.map((line) => <p key={line}>{line}</p>)}
        </div>

        <div className="evidence-block">
          <div>
            <span className={`confidence ${selectedPoem.confidence}`}>
              {confidenceLabels[selectedPoem.confidence]}
            </span>
            <span>{relationLabels[selectedPoem.relation]}</span>
          </div>
          <p>{selectedPoem.evidence}</p>
          <a href={selectedPoem.sourceUrl} target="_blank" rel="noreferrer">
            文本来源：{selectedPoem.sourceLabel} ↗
          </a>
        </div>

        <div className="poem-controls">
          <button type="button" onClick={() => moveSelection(-1)}>上一首</button>
          <div className="progress-dots">
            {poems.map((poem) => (
              <button
                key={poem.id}
                type="button"
                className={poem.id === selectedPoem.id ? 'active' : ''}
                onClick={() => selectPoem(poem)}
                aria-label={`查看${poem.author}《${poem.title}》`}
              />
            ))}
          </div>
          <button type="button" onClick={() => moveSelection(1)}>下一首</button>
        </div>
      </section>

      <footer className="release-note">
        <span>概念版 0.2</span>
        <p>{activeSnapshot.note}</p>
      </footer>

      {!entered && (
        <section className="entry-gate" aria-labelledby="entry-title">
          <div className="gate-orbit orbit-one" />
          <div className="gate-orbit orbit-two" />
          <div className="gate-content">
            <span className="gate-eyebrow">一卷山河 · 八处诗光</span>
            <h2 id="entry-title">
              诗行落在大地上，<br />声音随山河而流转。
            </h2>
            <p>
              从长安出发，沿江入梦。地图移动时，长安、江南与西域的程序化音景会自然交融。
            </p>
            <button type="button" className="enter-button" onClick={startExperience}>
              <span>展开诗卷</span>
              <i>开启声音与三维游历</i>
            </button>
            <small>建议佩戴耳机 · 进入后可随时静音</small>
          </div>
        </section>
      )}
    </main>
  )
}
