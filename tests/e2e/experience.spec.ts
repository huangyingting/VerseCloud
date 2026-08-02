import { expect, test } from '@playwright/test'

test('opens the 3D poetry experience and navigates between poems', async ({ page }) => {
  const runtimeErrors: string[] = []
  const cdp = await page.context().newCDPSession(page)
  let audioNodesCreated = 0
  let audioNodesDestroyed = 0
  await cdp.send('WebAudio.enable')
  cdp.on('WebAudio.audioNodeCreated', () => { audioNodesCreated += 1 })
  cdp.on('WebAudio.audioNodeWillBeDestroyed', () => { audioNodesDestroyed += 1 })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('Context Lost')) {
      runtimeErrors.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page).toHaveTitle('诗云 · Verse Cloud')
  await expect(page.getByRole('heading', { name: /诗行落在大地上/ })).toBeVisible()

  await page.getByRole('button', { name: /展开诗卷/ }).click()

  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-ready', 'true', {
    timeout: 15_000,
  })
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-history-ready', 'true')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-poem-hit-ready', 'true')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-scope', 'classical-china')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-dynasty', 'tang')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-history-layer', 'tang-context')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-boundary-rendered', 'false')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-poem-point-style', 'abstract-slip')
  await expect(page.locator('.geographic-map')).toHaveAttribute(
    'data-poem-route-renderer',
    'webgl-gradient',
  )
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-poem-route-state', 'idle')
  const placeGroups = JSON.parse(
    await page.locator('.geographic-map').getAttribute('data-poem-place-groups') ?? '[]',
  ) as Array<{
    key: string
    liftTier: number
    markerHeight: number
    hasNearbyPlace: boolean
  }>
  const crowdedCapitalMarkers = placeGroups.filter((group) =>
    ['changan', 'weicheng', 'puzhou-guanquelou'].includes(group.key),
  )
  expect(crowdedCapitalMarkers).toHaveLength(3)
  expect(crowdedCapitalMarkers.every((group) => group.hasNearbyPlace)).toBe(true)
  expect(new Set(crowdedCapitalMarkers.map((group) => group.liftTier)).size).toBe(3)
  await expect(page.locator('.map-legend, .interaction-hint, .release-note')).toHaveCount(0)
  expect(await page.locator('.geographic-map .maplibregl-marker').count()).toBeLessThanOrEqual(2)
  await expect(page.locator('canvas')).toHaveCSS('height', '960px')
  await expect(page.getByRole('heading', { name: '春望' })).toBeVisible()
  await expect(page.getByText('国破山河在，', { exact: true })).toBeVisible()
  await expect(page.getByText('城春草木深。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '8')
  await expect(page.locator('.map-poem-lines p')).toHaveCount(8)
  await expect(page.locator('.map-poem-lines p').first()).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.geographic-map .poem-effect.effect-petals-embers')).toBeVisible()
  expect(await page.locator('.poem-effect i').count()).toBe(8)
  await expect(page.locator('.poem-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '静音' })).toBeEnabled()
  await expect(page.locator('.soundscape-status')).toHaveAttribute(
    'data-poem-soundscape',
    '残春烽火',
  )
  await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCount(0)
  await expect(page.locator('.map-credits')).toContainText('© OpenStreetMap')

  const map = page.locator('.geographic-map')
  await expect(map).toHaveAttribute('data-intro-complete', 'true', { timeout: 8_000 })
  await expect(map).not.toHaveClass(/map-moving/, { timeout: 6_000 })
  await page.waitForTimeout(150)
  const mapBounds = await map.boundingBox()
  expect(mapBounds).not.toBeNull()
  const initialPoemScreenPositions = JSON.parse(
    await map.getAttribute('data-poem-screen-positions') ?? '{}',
  ) as Record<string, { x: number; y: number }>
  const weichengPoint = initialPoemScreenPositions['wang-wei-weicheng']
  const weichengMarker = placeGroups.find((group) => group.key === 'weicheng')
  expect(weichengPoint).toBeTruthy()
  expect(weichengMarker).toBeTruthy()
  // The crowded capital slips are clickable at their raised WebGL heads,
  // not only at the geographic base point.
  await page.mouse.click(
    (mapBounds?.x ?? 0) + weichengPoint.x,
    (mapBounds?.y ?? 0) + weichengPoint.y - weichengMarker!.markerHeight + 12,
  )
  await expect(page.getByRole('heading', { name: '送元二使安西' })).toBeVisible()
  await expect(map).toHaveAttribute('data-poem-route-from', 'du-fu-chun-wang')
  await expect(map).toHaveAttribute('data-poem-route-to', 'wang-wei-weicheng')
  await expect(map).toHaveAttribute('data-poem-route-state', 'settled', { timeout: 3_000 })
  await expect(map).not.toHaveClass(/map-moving/, { timeout: 3_000 })
  await page.waitForTimeout(100)
  const poemScreenPositions = JSON.parse(
    await map.getAttribute('data-poem-screen-positions') ?? '{}',
  ) as Record<string, { x: number; y: number }>
  const jiandePoint = poemScreenPositions['meng-haoran-jiande']
  expect(jiandePoint).toBeTruthy()
  await page.mouse.click(
    (mapBounds?.x ?? 0) + jiandePoint.x,
    (mapBounds?.y ?? 0) + jiandePoint.y,
  )
  await expect(page.getByRole('heading', { name: '宿建德江' })).toBeVisible()
  await expect(page.getByText('移舟泊烟渚，', { exact: true })).toBeVisible()
  await expect(page.getByText('日暮客愁新。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '4')
  await expect(page.locator('.era-year')).toHaveText('约730')
  await expect(page.locator('.era-panel p')).toHaveText('约开元十八年')
  await expect(page.locator('.soundscape-status')).toHaveAttribute(
    'data-poem-soundscape',
    '烟渚近月',
  )

  await expect(map).not.toHaveClass(/map-moving/, { timeout: 3_000 })
  const viewportCenter = {
    x: (mapBounds?.x ?? 0) + (mapBounds?.width ?? 0) / 2,
    y: (mapBounds?.y ?? 0) + (mapBounds?.height ?? 0) / 2,
  }
  // MapLibre updates DOM markers just after its public moveend listeners run.
  await page.waitForTimeout(100)

  const poemSign = page.locator('.map-poem-sign')
  const initialSignBounds = await poemSign.boundingBox()
  const initialScale = Number(await poemSign.getAttribute('data-zoom-scale'))
  expect(initialSignBounds).not.toBeNull()
  await map.evaluate((element) => {
    const recordWheelVisibility = () => {
      if (element.classList.contains('map-wheel-zooming')) {
        const sign = element.querySelector<HTMLElement>('.map-poem-sign')
        element.setAttribute(
          'data-wheel-sign-visible',
          sign && getComputedStyle(sign).opacity !== '0' ? 'true' : 'false',
        )
      }
    }
    const observeWheelZoom = new MutationObserver(recordWheelVisibility)
    observeWheelZoom.observe(element, { attributes: true, attributeFilter: ['class'] })
    element.addEventListener('wheel', recordWheelVisibility, { capture: true })
  })
  await page.mouse.move(viewportCenter.x, viewportCenter.y)
  await page.mouse.wheel(0, -900)
  await expect(map).toHaveAttribute('data-wheel-sign-visible', 'true')
  await expect(map).not.toHaveClass(/map-wheel-zooming/, { timeout: 2_000 })

  const focusedSignBounds = await poemSign.boundingBox()
  const focusedScale = Number(await poemSign.getAttribute('data-zoom-scale'))
  expect(focusedSignBounds).not.toBeNull()
  expect(focusedScale).toBeGreaterThan(initialScale)
  const distanceToCenter = (bounds: NonNullable<typeof initialSignBounds>) => Math.hypot(
    bounds.x + bounds.width / 2 - viewportCenter.x,
    bounds.y + bounds.height / 2 - viewportCenter.y,
  )
  expect(distanceToCenter(focusedSignBounds!)).toBeLessThan(distanceToCenter(initialSignBounds!))

  await map.evaluate((element) => element.removeAttribute('data-wheel-sign-visible'))
  await page.mouse.wheel(0, 900)
  await expect(map).toHaveAttribute('data-wheel-sign-visible', 'true')
  await expect(map).not.toHaveClass(/map-wheel-zooming/, { timeout: 2_000 })
  await page.waitForTimeout(150)
  const restoredSignBounds = await poemSign.boundingBox()
  const restoredScale = Number(await poemSign.getAttribute('data-zoom-scale'))
  expect(restoredSignBounds).not.toBeNull()
  expect(restoredScale).toBeLessThan(focusedScale)
  const centerDelta = (
    first: NonNullable<typeof initialSignBounds>,
    second: NonNullable<typeof initialSignBounds>,
  ) => Math.hypot(
    first.x + first.width / 2 - second.x - second.width / 2,
    first.y + first.height / 2 - second.y - second.height / 2,
  )
  expect(centerDelta(restoredSignBounds!, initialSignBounds!)).toBeLessThan(12)

  await page.getByRole('button', { name: '秋', exact: true }).click()
  await expect(page.locator('main')).toHaveClass(/season-autumn/)
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-season', 'autumn')

  await page.getByRole('button', { name: /诗库/ }).click()
  await page.locator('[data-library-poem="li-bai-baidi"]').click()
  await page.locator('.poem-library > header button').click()
  await expect(page.getByRole('heading', { name: '早发白帝城' })).toBeVisible()
  await expect(page.getByText('朝辞白帝彩云间，', { exact: true })).toBeVisible()
  await expect(page.getByText('千里江陵一日还。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '4')
  await expect(page.locator('.era-year')).toHaveText('759')
  await expect(page.locator('.era-panel p')).toHaveText('乾元二年')
  await expect(page.locator('.soundscape-status')).toHaveAttribute(
    'data-poem-soundscape',
    '彩云轻舟',
  )
  await expect(page.locator('.geographic-map .poem-effect.effect-river-flight')).toBeVisible()
  await expect(page.locator('.poem-card')).toHaveCount(0)

  await page.getByRole('button', { name: /诗库/ }).click()
  await page.locator('[data-library-poem="wang-wei-weicheng"]').click()
  await page.locator('.poem-library > header button').click()
  await expect(page.getByRole('heading', { name: '送元二使安西' })).toBeVisible()
  await expect(page.getByText('唐·王维', { exact: true })).toBeVisible()
  await expect(page.getByText('渭城·朝雨·柳色', { exact: true })).toBeVisible()
  const verticalColumnsFit = await page.locator('.map-poem-sign').evaluate((sign) =>
    [...sign.querySelectorAll('h1, .map-poem-author, .map-poem-lines p, footer')]
      .every((column) => column.scrollHeight <= column.clientHeight),
  )
  expect(verticalColumnsFit).toBe(true)
  expect(audioNodesCreated - audioNodesDestroyed).toBeLessThanOrEqual(260)
  expect(runtimeErrors).toEqual([])
})

test('publishes and browses every literary period', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('Context Lost')) {
      runtimeErrors.push(message.text())
    }
  })

  const periods = [
    { id: 'pre-qin', label: '先秦', firstTitle: '关雎', count: 6 },
    { id: 'han', label: '汉', firstTitle: '大风歌', count: 10 },
    { id: 'wei-jin', label: '魏晋', firstTitle: '七步诗', count: 4 },
    { id: 'southern-northern', label: '南北朝', firstTitle: '敕勒歌', count: 4 },
    { id: 'sui', label: '隋', firstTitle: '人日思归', count: 3 },
    { id: 'tang', label: '唐', firstTitle: '春望', count: 103 },
    { id: 'five-dynasties', label: '五代', firstTitle: '虞美人', count: 3 },
    { id: 'song', label: '宋', firstTitle: '水调歌头', count: 58 },
    { id: 'yuan', label: '元', firstTitle: '天净沙·秋思', count: 4 },
    { id: 'ming', label: '明', firstTitle: '石灰吟', count: 5 },
    { id: 'qing', label: '清', firstTitle: '己亥杂诗·其五', count: 10 },
  ]

  await page.goto('/')
  await expect(page.locator('.dynasty-nav button')).toHaveCount(periods.length)
  await expect(page.getByText('十一段诗史 · 210处诗光')).toBeVisible()
  await page.getByRole('button', { name: /展开诗卷/ }).click()

  for (const period of periods) {
    const periodButton = page.locator(`.dynasty-nav [data-dynasty="${period.id}"]`)
    await periodButton.click()
    await expect(periodButton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-ready', 'true', {
      timeout: 15_000,
    })
    await expect(page.locator('.geographic-map')).toHaveAttribute('data-dynasty', period.id)
    await expect(page.getByRole('heading', { name: period.firstTitle, exact: true })).toBeVisible()
    await page.getByRole('button', { name: /诗库/ }).click()
    await expect(page.locator('.library-poems > button')).toHaveCount(period.count)
    await expect(page.locator('.poem-library')).toContainText(period.label)
    await expect(page.locator('.library-evidence')).toBeVisible()
    await page.locator('.poem-library > header button').click()
  }

  await page.getByRole('button', { name: /诗库/ }).click()
  await page.getByRole('searchbox', { name: '搜索当前时期的诗词' }).fill('袁枚')
  await expect(page.locator('.library-poems > button')).toHaveCount(2)
  await expect(page.locator('.library-search b')).toHaveText('2/10')
  await page.locator('[data-library-poem="yuan-mei-moss"]').click()
  await expect(page.getByRole('heading', { name: '苔', exact: true })).toBeVisible()
  await expect(page.locator('.library-evidence')).toContainText('金陵随园')
  await page.getByRole('searchbox', { name: '搜索当前时期的诗词' }).fill('')
  await page.getByRole('button', { name: '小学', exact: true }).click()
  await expect(page.locator('.library-search b')).toHaveText('6/10')
  await expect(page.locator('.library-poems > button')).toHaveCount(6)
  await expect(page.locator('.library-poems > button small em')).toHaveText([
    '小学', '小学', '小学', '小学', '小学', '小学',
  ])
  await page.getByRole('button', { name: '初中', exact: true }).click()
  await expect(page.locator('.library-search b')).toHaveText('3/10')
  expect(runtimeErrors).toEqual([])
})

test('keeps every poem readable on a reduced-motion mobile viewport', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('Context Lost')) {
      runtimeErrors.push(message.text())
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: /展开诗卷/ }).click()
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-intro-complete', 'true', {
    timeout: 15_000,
  })

  const periodIds = [
    'pre-qin', 'han', 'wei-jin', 'southern-northern', 'sui', 'tang',
    'five-dynasties', 'song', 'yuan', 'ming', 'qing',
  ]
  let visitedPoems = 0

  for (const periodId of periodIds) {
    await page.locator(`.dynasty-nav [data-dynasty="${periodId}"]`).click()
    const map = page.locator(`.geographic-map[data-dynasty="${periodId}"]`)
    await expect(map).toHaveAttribute('data-intro-complete', 'true', { timeout: 15_000 })
    await page.getByRole('button', { name: /诗库/ }).click()
    const poemIds = await page.locator('[data-library-poem]').evaluateAll((buttons) =>
      buttons.map((button) => (button as HTMLElement).dataset.libraryPoem ?? ''),
    )
    await page.locator('.poem-library > header button').click()

    for (const poemId of poemIds) {
      await page.getByRole('button', { name: /诗库/ }).click()
      const poemButton = page.locator(`[data-library-poem="${poemId}"]`)
      await poemButton.evaluate((button: HTMLButtonElement) => button.click())
      await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-poem-id', poemId)
      const layout = await page.locator('.map-poem-sign').evaluate((sign) => {
        const bounds = sign.getBoundingClientRect()
        const columns = [...sign.querySelectorAll('h1, .map-poem-author, .map-poem-lines p, footer')]
        return {
          insideViewport:
            bounds.left >= -0.5
            && bounds.top >= -0.5
            && bounds.right <= window.innerWidth + 0.5
            && bounds.bottom <= window.innerHeight + 0.5,
          columnsFit: columns.every((column) => column.scrollHeight <= column.clientHeight + 1),
          frameFits: sign.scrollWidth <= sign.clientWidth + 1,
        }
      })
      expect(layout, `${periodId}/${poemId}`).toEqual({
        insideViewport: true,
        columnsFit: true,
        frameFits: true,
      })
      visitedPoems += 1
    }
  }

  expect(visitedPoems).toBe(210)
  expect(runtimeErrors).toEqual([])
})

test('keeps the WebGL scene alive on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const contextLosses: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Context Lost')) contextLosses.push(message.text())
  })

  await page.goto('/')
  await page.getByRole('button', { name: /展开诗卷/ }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-ready', 'true', {
    timeout: 15_000,
  })
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-history-ready', 'true')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-poem-hit-ready', 'true')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-scope', 'classical-china')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-dynasty', 'tang')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-boundary-rendered', 'false')
  await expect(page.locator('.map-legend, .interaction-hint, .release-note')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCSS('height', '844px')

  await expect(page.getByRole('heading', { name: '春望' })).toBeVisible()
  await expect(page.getByText('国破山河在，', { exact: true })).toBeVisible()
  await expect(page.getByText('城春草木深。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '8')
  await expect(page.locator('.map-poem-lines p')).toHaveCount(8)
  await expect(page.locator('.map-poem-lines p').first()).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.poem-card')).toHaveCount(0)

  const mobileMap = page.locator('.geographic-map')
  const mobileSign = page.locator('.map-poem-sign')
  await expect(mobileMap).toHaveAttribute('data-intro-complete', 'true', { timeout: 8_000 })
  const mobileInitialScale = Number(await mobileSign.getAttribute('data-zoom-scale'))
  await page.mouse.move(195, 422)
  await page.mouse.wheel(0, -900)
  await expect(mobileMap).not.toHaveClass(/map-wheel-zooming/, { timeout: 2_000 })
  const mobileFocusedScale = Number(await mobileSign.getAttribute('data-zoom-scale'))
  const mobileSignBounds = await mobileSign.boundingBox()
  expect(mobileFocusedScale).toBeGreaterThan(mobileInitialScale)
  expect(mobileFocusedScale).toBeLessThanOrEqual(1.3)
  expect(mobileSignBounds).not.toBeNull()
  expect(mobileSignBounds!.x).toBeGreaterThanOrEqual(0)
  expect(mobileSignBounds!.y).toBeGreaterThanOrEqual(0)
  expect(mobileSignBounds!.x + mobileSignBounds!.width).toBeLessThanOrEqual(390)
  expect(mobileSignBounds!.y + mobileSignBounds!.height).toBeLessThanOrEqual(844)

  await page.locator('.dynasty-nav [data-dynasty="song"]').click()
  await expect(page.getByRole('heading', { name: '水调歌头', exact: true })).toBeVisible()
  await expect(mobileMap).not.toHaveClass(/map-moving/, { timeout: 6_000 })
  await expect(mobileSign).toHaveAttribute('data-sentence-count', '19')
  const songScrollLayout = await mobileSign.evaluate((sign) => {
    const bounds = sign.getBoundingClientRect()
    return {
      columns: Number((sign as HTMLElement).dataset.columnCount),
      frameFits: sign.scrollWidth <= sign.clientWidth + 1,
      insideViewport:
        bounds.left >= -0.5
        && bounds.right <= window.innerWidth + 0.5
        && bounds.top >= -0.5
        && bounds.bottom <= window.innerHeight + 0.5,
    }
  })
  expect(songScrollLayout.columns).toBeLessThan(19)
  expect(songScrollLayout.frameFits).toBe(true)
  expect(songScrollLayout.insideViewport).toBe(true)
  expect(contextLosses).toEqual([])
})
