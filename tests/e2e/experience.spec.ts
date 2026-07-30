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
  const poemScreenPositions = JSON.parse(
    await map.getAttribute('data-poem-screen-positions') ?? '{}',
  ) as Record<string, { x: number; y: number }>
  const mapBounds = await map.boundingBox()
  const jiandePoint = poemScreenPositions['meng-haoran-jiande']
  expect(mapBounds).not.toBeNull()
  expect(jiandePoint).toBeTruthy()
  await page.mouse.click(
    (mapBounds?.x ?? 0) + jiandePoint.x,
    (mapBounds?.y ?? 0) + jiandePoint.y,
  )
  await expect(page.getByRole('heading', { name: '宿建德江' })).toBeVisible()
  await expect(page.getByText('移舟泊烟渚，', { exact: true })).toBeVisible()
  await expect(page.getByText('日暮客愁新。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '4')

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
  await expect(page.locator('canvas')).toHaveCSS('height', '844px')

  await expect(page.getByRole('heading', { name: '春望' })).toBeVisible()
  await expect(page.getByText('国破山河在，', { exact: true })).toBeVisible()
  await expect(page.getByText('城春草木深。', { exact: true })).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toBeVisible()
  await expect(page.locator('.map-poem-sign')).toHaveAttribute('data-sentence-count', '8')
  await expect(page.locator('.map-poem-lines p')).toHaveCount(8)
  await expect(page.locator('.map-poem-lines p').first()).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.poem-card')).toHaveCount(0)
  expect(contextLosses).toEqual([])
})
