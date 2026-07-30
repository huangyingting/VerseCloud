import { expect, test } from '@playwright/test'

test('opens the 3D poetry experience and navigates between poems', async ({ page }) => {
  const runtimeErrors: string[] = []
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
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-scope', 'tang-surroundings')
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-boundary-rendered', 'false')
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
  await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCount(0)

  const map = page.locator('.geographic-map')
  await expect(map).toHaveAttribute('data-intro-complete', 'true', { timeout: 8_000 })
  await expect(map).not.toHaveClass(/map-moving/, { timeout: 2_000 })
  await page.waitForTimeout(150)
  const mapBounds = await map.boundingBox()
  expect(mapBounds).not.toBeNull()
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

  await page.locator('[data-poem-select="li-bai-baidi"]').evaluate((button: HTMLButtonElement) => {
    button.click()
  })
  await expect(page.getByRole('heading', { name: '早发白帝城' })).toBeVisible()
  await expect(page.getByText('朝辞白帝彩云间，', { exact: true })).toBeVisible()
  await expect(page.getByText('千里江陵一日还。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '4')
  await expect(page.locator('.geographic-map .poem-effect.effect-river-flight')).toBeVisible()
  await expect(page.locator('.poem-card')).toHaveCount(0)

  await page.locator('[data-poem-select="wang-wei-weicheng"]').evaluate((button: HTMLButtonElement) => {
    button.click()
  })
  await expect(page.getByRole('heading', { name: '送元二使安西' })).toBeVisible()
  await expect(page.getByText('唐·王维', { exact: true })).toBeVisible()
  await expect(page.getByText('渭城·朝雨·柳色', { exact: true })).toBeVisible()
  const verticalColumnsFit = await page.locator('.map-poem-sign').evaluate((sign) =>
    [...sign.querySelectorAll('h1, .map-poem-author, .map-poem-lines p, footer')]
      .every((column) => column.scrollHeight <= column.clientHeight),
  )
  expect(verticalColumnsFit).toBe(true)
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
  await expect(page.locator('.geographic-map')).toHaveAttribute('data-map-scope', 'tang-surroundings')
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
  expect(contextLosses).toEqual([])
})
