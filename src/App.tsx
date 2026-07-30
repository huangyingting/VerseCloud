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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'landscape' | 'poem'>('landscape')
  const [mix, setMix] = useState<SoundscapeMix>(() =>
    computeSoundscapeMix(initialFocus),
  )
  const [focusPoint, setFocusPoint] = useState<ScenePoint>(initialFocus)
  const engine = useRef<SoundscapeEngine | null>(null)
  const introTimer = useRef<number | null>(null)

  const selectedIndex = useMemo(
    () => poems.findIndex((poem) => poem.id === selectedPoem.id),
    [selectedPoem.id],
  )

  const startExperience = async () => {
    setEntered(true)
    setDetailsOpen(false)
    setMobileView('landscape')
    if (!window.matchMedia('(max-width: 680px)').matches) {
      introTimer.current = window.setTimeout(() => setDetailsOpen(true), 3_500)
    }
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
    if (window.matchMedia('(max-width: 680px)').matches) setMobileView('poem')
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
    return () => {
      if (introTimer.current) window.clearTimeout(introTimer.current)
      engine.current?.dispose()
    }
  }, [])

  const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八']

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
        <span><i className="legend-relief" />真实高程</span>
        <span><i className="legend-area" />概念疆域</span>
      </section>

      <div className="interaction-hint">
        <span>拖动山河</span>
        <span>右键旋转</span>
        <span>滚轮远近</span>
        <span>点击诗光</span>
      </div>

      {entered && (
        <div className="mobile-view-switch" aria-label="移动端视图">
          <button
            type="button"
            className={mobileView === 'landscape' ? 'active' : ''}
            onClick={() => {
              setMobileView('landscape')
              setDetailsOpen(false)
            }}
          >
            山河
          </button>
          <button
            type="button"
            className={mobileView === 'poem' ? 'active' : ''}
            onClick={() => {
              setMobileView('poem')
              setDetailsOpen(true)
            }}
          >
            诗卷
          </button>
        </div>
      )}

      {entered && (
        <section className={`poem-card ${detailsOpen ? 'open' : 'collapsed'} mobile-${mobileView}`}>
        <button
          type="button"
          className="card-toggle"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? '收起诗词详情' : '展开诗词详情'}
        >
          {detailsOpen ? '合卷' : '展卷'}
        </button>

        <div className="poem-meta">
          <div className="poem-location">
            <span className="place-chip">{selectedPoem.placeName}</span>
            <small>意象 · {selectedPoem.visualEffectLabel}</small>
          </div>
          <span className="poem-count">
            其{chineseNumbers[selectedIndex]}
            <small> · 共八首</small>
          </span>
        </div>

        <div className="vertical-reading">
          <h1>{selectedPoem.title}</h1>
          <p className="vertical-author">唐 · {selectedPoem.author}</p>
          <div className="poem-lines" aria-label={selectedPoem.lines.join('，')}>
            {selectedPoem.lines.map((line) => <p key={line}>{line}</p>)}
          </div>
          <span className="poet-seal" aria-hidden="true">{selectedPoem.author.slice(0, 1)}</span>
        </div>

        <details className="evidence-block">
          <summary>考据</summary>
          <div className="evidence-content">
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
        </details>

        <div className="poem-controls">
          <button type="button" onClick={() => moveSelection(-1)}>前卷</button>
          <div className="progress-dots">
            {poems.map((poem, index) => (
              <button
                key={poem.id}
                type="button"
                className={poem.id === selectedPoem.id ? 'active' : ''}
                onClick={() => selectPoem(poem)}
                aria-label={`查看${poem.author}《${poem.title}》`}
              >
                <span>{chineseNumbers[index]}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => moveSelection(1)}>后卷</button>
        </div>
        </section>
      )}

      <footer className="release-note">
        <span>山河卷 0.5</span>
        <p>{activeSnapshot.note}</p>
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
