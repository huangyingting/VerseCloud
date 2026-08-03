import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { dynastyLabels, snapshots } from './data/mapSnapshots'
import {
  confidenceLabels,
  datePrecisionLabels,
  defaultPoem,
  poems,
  relationLabels,
} from './data/poems'
import {
  computeSoundscapeMix,
  poemSoundscapeLabel,
  soundscapeLabel,
  SoundscapeEngine,
} from './lib/soundscape'
import { projectPoint } from './lib/geo'
import { SceneBoundary } from './components/SceneBoundary'
import type { DynastyId, Poem, ScenePoint, SoundscapeMix } from './types'

type LibraryLevel = 'all' | 'primary' | 'middle'

const initialFocus = { x: 0, y: 0 }
const VerseScene = lazy(() =>
  import('./components/VerseScene').then((module) => ({ default: module.VerseScene })),
)

export function App() {
  const [selectedPoem, setSelectedPoem] = useState(defaultPoem)
  const [activeDynasty, setActiveDynasty] = useState<DynastyId>(defaultPoem.dynasty)
  const [entered, setEntered] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryLevel, setLibraryLevel] = useState<LibraryLevel>('all')
  const [mix, setMix] = useState<SoundscapeMix>(() =>
    computeSoundscapeMix(initialFocus),
  )
  const focusPoint = useRef<ScenePoint>(initialFocus)
  const engine = useRef<SoundscapeEngine | null>(null)
  const dynastyNavRef = useRef<HTMLElement>(null)
  const libraryButtonRef = useRef<HTMLButtonElement>(null)
  const libraryPanelRef = useRef<HTMLElement>(null)
  const libraryWasOpenRef = useRef(false)
  const dynastyPoems = useMemo(
    () => poems.filter((poem) => poem.dynasty === activeDynasty),
    [activeDynasty],
  )
  const activeSnapshot = snapshots.find((snapshot) => snapshot.dynasty === activeDynasty)
    ?? snapshots[0]
  const poemYearFloor = Math.min(...dynastyPoems.map((poem) => poem.year))
  const poemYearCeiling = Math.max(...dynastyPoems.map((poem) => poem.year))
  const eraProgress = poemYearCeiling === poemYearFloor
    ? 50
    : ((selectedPoem.year - poemYearFloor) / (poemYearCeiling - poemYearFloor)) * 100
  const visibleLibraryPoems = useMemo(() => {
    const query = libraryQuery.trim().toLocaleLowerCase('zh-CN')
    return dynastyPoems.filter((poem) =>
      (libraryLevel === 'all' || poem.curriculumLevels?.includes(libraryLevel))
      && (!query || [
        poem.title,
        poem.author,
        poem.placeName,
        poem.yearLabel,
        poem.eraLabel,
        poem.curriculumLevels?.includes('primary') ? '小学' : '',
        poem.curriculumLevels?.includes('middle') ? '初中' : '',
      ].some((value) => value.toLocaleLowerCase('zh-CN').includes(query))),
    )
  }, [dynastyPoems, libraryLevel, libraryQuery])

  const startExperience = async () => {
    setEntered(true)
    if (!engine.current) engine.current = new SoundscapeEngine()
    try {
      const startingPoint = projectPoint(selectedPoem.longitude, selectedPoem.latitude)
      focusPoint.current = startingPoint
      setMix(computeSoundscapeMix(startingPoint))
      await engine.current.start(startingPoint, selectedPoem)
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
    setActiveDynasty(poem.dynasty)
    const poemPoint = projectPoint(poem.longitude, poem.latitude)
    focusPoint.current = poemPoint
    const nextMix = engine.current?.update(poemPoint) ?? computeSoundscapeMix(poemPoint)
    setMix(nextMix)
    engine.current?.transitionToPoem(poem)
    engine.current?.playPoemCue(poem)
  }, [])

  const chooseDynasty = (dynasty: DynastyId) => {
    if (dynasty === activeDynasty) return
    const firstPoem = poems.find((poem) => poem.dynasty === dynasty)
    if (!firstPoem) return
    setLibraryQuery('')
    setLibraryLevel('all')
    selectPoem(firstPoem)
  }

  const chooseLibraryPoem = (poem: Poem) => {
    selectPoem(poem)
    if (window.matchMedia('(max-width: 680px)').matches) setLibraryOpen(false)
  }

  const toggleMute = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    engine.current?.setMuted(nextMuted)
  }

  useEffect(() => {
    dynastyNavRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeDynasty])

  useEffect(() => {
    if (!libraryOpen) {
      if (libraryWasOpenRef.current) {
        libraryWasOpenRef.current = false
        window.requestAnimationFrame(() => libraryButtonRef.current?.focus())
      }
      return
    }

    libraryWasOpenRef.current = true
    const keepFocusInLibrary = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setLibraryOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const panel = libraryPanelRef.current
      if (!panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (!panel.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', keepFocusInLibrary)
    return () => window.removeEventListener('keydown', keepFocusInLibrary)
  }, [libraryOpen])

  useEffect(() => {
    return () => {
      engine.current?.dispose()
    }
  }, [])

  return (
    <main id="top" className="app-shell">
      <div
        className="scene-layer"
        inert={!entered || libraryOpen ? true : undefined}
        aria-hidden={!entered || libraryOpen ? true : undefined}
      >
        {entered && (
          <SceneBoundary resetKey={activeDynasty}>
            <Suspense fallback={<div className="scene-loading">山河入卷中…</div>}>
              <VerseScene
                poems={dynastyPoems}
                selectedPoem={selectedPoem}
                onSelectPoem={selectPoem}
                onFocusChange={handleFocusChange}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      <div className="vignette" aria-hidden="true" />
      <div className="paper-grain" aria-hidden="true" />

      <header
        className="topbar"
        inert={!entered || libraryOpen ? true : undefined}
        aria-hidden={!entered || libraryOpen ? true : undefined}
      >
        <a className="brand" href="#top" aria-label="诗云首页">
          <span className="brand-seal">诗</span>
          <span>
            <strong>诗云</strong>
            <small>VERSE CLOUD</small>
          </span>
        </a>

        <nav ref={dynastyNavRef} className="dynasty-nav" aria-label="文学时期选择">
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              type="button"
              className={snapshot.dynasty === activeDynasty ? 'active' : ''}
              data-dynasty={snapshot.dynasty}
              aria-pressed={snapshot.dynasty === activeDynasty}
              title={`${snapshot.dateRange} · ${snapshot.note}`}
              onClick={() => chooseDynasty(snapshot.dynasty)}
            >
              {snapshot.dynastyLabel}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <div
            className="soundscape-status"
            aria-live="polite"
            data-poem-soundscape={poemSoundscapeLabel(selectedPoem)}
          >
            <span className={soundEnabled && !muted ? 'sound-dot playing' : 'sound-dot'} />
            <span>
              <small>此刻音景</small>
              {soundEnabled
                ? `${soundscapeLabel(mix)} · ${poemSoundscapeLabel(selectedPoem)}`
                : '静音游历'}
            </span>
          </div>
          <button
            ref={libraryButtonRef}
            type="button"
            className="library-button"
            aria-label={libraryOpen ? '关闭诗库' : `打开诗库，共${poems.length}首`}
            aria-expanded={libraryOpen}
            aria-controls="poem-library"
            onClick={() => setLibraryOpen((open) => !open)}
          >
            <span>诗库</span>
            <b>{poems.length}</b>
          </button>
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

      <aside
        className="era-panel"
        aria-hidden={!entered || libraryOpen ? true : undefined}
        aria-live="polite"
        aria-label={`${selectedPoem.title}年代`}
        style={{ '--era-progress': `${eraProgress.toFixed(1)}%` } as CSSProperties}
      >
        <span className="era-kicker">时空坐标</span>
        <strong>{dynastyLabels[selectedPoem.dynasty]}</strong>
        <div className="era-year">{selectedPoem.yearLabel}</div>
        <p>{selectedPoem.eraLabel}</p>
        <div className="timeline-track">
          <span />
        </div>
        <small>考订纪年</small>
      </aside>

      {entered && (
        <footer
          className="map-credits"
          aria-label="地图数据来源"
          inert={libraryOpen ? true : undefined}
          aria-hidden={libraryOpen ? true : undefined}
        >
          <span>地形 Natural Earth</span>
          <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
        </footer>
      )}

      {entered && libraryOpen && (
        <>
          <button
            type="button"
            className="library-scrim"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setLibraryOpen(false)}
          />
          <aside
            ref={libraryPanelRef}
            id="poem-library"
            className="poem-library"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poem-library-title"
          >
            <header>
              <div>
                <span>跨朝代诗词库</span>
                <h2 id="poem-library-title">{activeSnapshot.dynastyLabel}</h2>
              </div>
              <button type="button" aria-label="关闭诗库" onClick={() => setLibraryOpen(false)}>×</button>
            </header>
            <p className="period-note">
              {activeSnapshot.dateRange} · {activeSnapshot.note} · 本期{dynastyPoems.length}首
            </p>
            <div className="curriculum-filter" role="group" aria-label="教材范围">
              {([
                ['all', '全部'],
                ['primary', '小学'],
                ['middle', '初中'],
              ] as const).map(([level, label]) => (
                <button
                  key={level}
                  type="button"
                  className={libraryLevel === level ? 'active' : ''}
                  aria-pressed={libraryLevel === level}
                  onClick={() => setLibraryLevel(level)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="library-search">
              <span className="sr-only">搜索当前时期的诗词</span>
              <input
                type="search"
                value={libraryQuery}
                placeholder={`搜索${activeSnapshot.dynastyLabel}诗题、作者、年代或地点`}
                onChange={(event) => setLibraryQuery(event.target.value)}
                autoFocus
              />
              <b>{visibleLibraryPoems.length}/{dynastyPoems.length}</b>
            </label>
            <div className="library-poems" role="list" aria-label={`${activeSnapshot.dynastyLabel}作品`}>
              {visibleLibraryPoems.map((poem, index) => (
                <button
                  key={poem.id}
                  type="button"
                  role="listitem"
                  className={poem.id === selectedPoem.id ? 'active' : ''}
                  aria-current={poem.id === selectedPoem.id ? 'true' : undefined}
                  data-library-poem={poem.id}
                  onClick={() => chooseLibraryPoem(poem)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{poem.title}</strong>
                  <small>
                    {poem.curriculumLevels && (
                      <em>
                        {poem.curriculumLevels
                          .map((level) => level === 'primary' ? '小学' : '初中')
                          .join('·')}
                      </em>
                    )}
                    <span>{poem.author} · {poem.yearLabel} · {poem.placeName}</span>
                  </small>
                </button>
              ))}
              {visibleLibraryPoems.length === 0 && (
                <p className="library-empty">没有匹配的作品，换一个关键词试试。</p>
              )}
            </div>
            <section className="library-evidence" aria-label="当前作品考订说明">
              <div className="date-evidence">
                <span>{datePrecisionLabels[selectedPoem.datePrecision]}</span>
                <b>{selectedPoem.yearLabel} · {selectedPoem.eraLabel}</b>
                <p>{selectedPoem.dateEvidence}</p>
              </div>
              <div className="place-evidence">
                <span style={{ '--poem-accent': selectedPoem.accent } as CSSProperties}>
                  {relationLabels[selectedPoem.relation]}
                </span>
                <b>{confidenceLabels[selectedPoem.confidence]}</b>
                <p>{selectedPoem.evidence}</p>
              </div>
              <a href={selectedPoem.sourceUrl} target="_blank" rel="noreferrer">
                文本来源：{selectedPoem.sourceLabel}
              </a>
            </section>
          </aside>
        </>
      )}

      {!entered && (
        <section
          className="entry-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-title"
          aria-describedby="entry-description"
        >
          <div className="gate-contour contour-one" />
          <div className="gate-contour contour-two" />
          <div className="gate-contour contour-three" />
          <div className="gate-content">
            <span className="gate-eyebrow">
              十一段诗史 · {poems.length}处诗光
            </span>
            <h1 id="entry-title">
              诗行落在大地上，<br />声音随山河而流转。
            </h1>
            <p id="entry-description">
              从先秦歌谣到清代诗篇，收录统编小学、初中古诗词，在真实山河间循时代、作者与地点游历。
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
