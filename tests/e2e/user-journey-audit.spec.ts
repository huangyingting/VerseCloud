import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

interface RuntimeDiagnostics {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  expectedAbortedRequests: string[]
}

interface InteractionDiagnostics {
  activeElement: string
  duplicateIds: string[]
  horizontalOverflow: number
  unlabeledControls: string[]
  smallTargets: Array<{ label: string; width: number; height: number }>
}

interface InteractionRecord {
  step: number
  action: string
  target: string
  outcome: string
  url: string
  screenshot: string
  diagnostics: InteractionDiagnostics
}

interface JourneyPayload {
  journey: string
  project: string
  viewport: { width: number; height: number } | null
  minimumTargetSize: number
  records: InteractionRecord[]
  runtime: RuntimeDiagnostics
}

const auditRoot = path.resolve(
  process.env.USER_AUDIT_DIR ?? 'test-results/user-journey-audit',
)

function safeName(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9\u3400-\u9fff]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 64)
}

function monitorRuntime(page: Page): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    expectedAbortedRequests: [],
  }
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('Context Lost')) {
      diagnostics.consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown failure'
    const message = `${request.method()} ${request.url()} — ${failure}`
    if (
      failure.includes('ERR_ABORTED')
      && request.url().startsWith('https://tiles.openfreemap.org/')
    ) {
      diagnostics.expectedAbortedRequests.push(message)
    } else {
      diagnostics.failedRequests.push(message)
    }
  })
  return diagnostics
}

async function inspectInteraction(
  page: Page,
  minimumTargetSize: number,
): Promise<InteractionDiagnostics> {
  return page.evaluate((targetMinimum) => {
    const visible = (element: Element) => {
      if (element.closest('[inert]')) return false
      const html = element as HTMLElement
      const style = getComputedStyle(html)
      const bounds = html.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && bounds.width > 0
        && bounds.height > 0
    }
    const labelFor = (element: Element) => {
      const html = element as HTMLElement
      return element.getAttribute('aria-label')
        || element.getAttribute('title')
        || html.innerText?.trim()
        || (element as HTMLInputElement).placeholder
        || element.tagName.toLocaleLowerCase('en-US')
    }
    const controls = [...document.querySelectorAll('button, a[href], input, [tabindex]')]
      .filter(visible)
    const coreTargets = controls.filter((element) => element.matches([
      '.enter-button', '.brand', '.dynasty-nav button', '.library-button',
      '.icon-button', '.verse-compass',
      '.poem-library > header button', '.curriculum-filter button',
      '.library-search input', '.library-poems > button', '.library-evidence a',
      '.poem-group-choice',
    ].join(',')))
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id)
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
    const unlabeledControls = controls
      .filter((element) => {
        if (element.getAttribute('aria-hidden') === 'true') return false
        if (element instanceof HTMLInputElement) {
          return !element.labels?.length
            && !element.getAttribute('aria-label')
            && !element.getAttribute('aria-labelledby')
            && !element.placeholder
        }
        return !labelFor(element)
      })
      .map((element) => element.outerHTML.slice(0, 160))
    const smallTargets = coreTargets
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          label: labelFor(element).replace(/\s+/gu, ' ').slice(0, 64),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        }
      })
      .filter((target) => target.width < targetMinimum || target.height < targetMinimum)
    const active = document.activeElement
    return {
      activeElement: active
        ? `${active.tagName.toLocaleLowerCase('en-US')}:${labelFor(active)
            .replace(/\s+/gu, ' ').slice(0, 120)}`
        : 'none',
      duplicateIds,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      unlabeledControls,
      smallTargets,
    }
  }, minimumTargetSize)
}

async function createRecorder(
  page: Page,
  testInfo: TestInfo,
  journey: string,
  runtime: RuntimeDiagnostics,
  minimumTargetSize: number,
) {
  const records: InteractionRecord[] = []
  const journeyDir = path.join(auditRoot, journey)
  await mkdir(journeyDir, { recursive: true })

  const record = async (action: string, target: string, outcome: string) => {
    await page.waitForTimeout(180)
    const step = records.length + 1
    const filename = `${String(step).padStart(2, '0')}-${safeName(action)}.png`
    const screenshotPath = path.join(journeyDir, filename)
    await page.screenshot({ path: screenshotPath, animations: 'disabled' })
    records.push({
      step,
      action,
      target,
      outcome,
      url: page.url(),
      screenshot: screenshotPath,
      diagnostics: await inspectInteraction(page, minimumTargetSize),
    })
  }

  const finish = async () => {
    const payload: JourneyPayload = {
      journey,
      project: testInfo.project.name,
      viewport: page.viewportSize(),
      minimumTargetSize,
      records,
      runtime,
    }
    const logPath = path.join(journeyDir, 'interactions.json')
    await writeFile(logPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    await testInfo.attach(`${journey}-interaction-log`, {
      body: Buffer.from(JSON.stringify(payload, null, 2)),
      contentType: 'application/json',
    })
    return payload
  }

  return { record, finish }
}

function assertJourney(payload: JourneyPayload) {
  const diagnosticProblems = payload.records.flatMap((record) => [
    ...record.diagnostics.duplicateIds.map((id) => `${record.action}: duplicate id ${id}`),
    ...record.diagnostics.unlabeledControls.map((control) =>
      `${record.action}: unlabeled ${control}`),
    ...(record.diagnostics.horizontalOverflow > 0
      ? [`${record.action}: ${record.diagnostics.horizontalOverflow}px horizontal overflow`]
      : []),
    ...record.diagnostics.smallTargets.map((target) =>
      `${record.action}: ${target.label} is ${target.width}x${target.height}`),
  ])
  expect(diagnosticProblems).toEqual([])
  expect(payload.runtime.consoleErrors).toEqual([])
  expect(payload.runtime.pageErrors).toEqual([])
  expect(payload.runtime.failedRequests).toEqual([])
  expect(payload.records.every((record) => record.screenshot.endsWith('.png'))).toBe(true)
}

async function waitForStableMap(page: Page) {
  const map = page.locator('.geographic-map')
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 15_000 })
  await expect(map).toHaveAttribute('data-intro-complete', 'true', { timeout: 15_000 })
  await expect(map).not.toHaveClass(/map-moving/, { timeout: 8_000 })
}

async function clickPoemPlaceMarker(page: Page, poemId: string, placeKey: string) {
  await waitForStableMap(page)
  const map = page.locator('.geographic-map')
  const bounds = await map.boundingBox()
  expect(bounds).not.toBeNull()
  const positions = JSON.parse(
    await map.getAttribute('data-poem-screen-positions') ?? '{}',
  ) as Record<string, { x: number; y: number }>
  const groups = JSON.parse(
    await map.getAttribute('data-poem-place-groups') ?? '[]',
  ) as Array<{ key: string; markerHeight: number }>
  const point = positions[poemId]
  const group = groups.find((candidate) => candidate.key === placeKey)
  expect(point, poemId).toBeTruthy()
  expect(group, placeKey).toBeTruthy()
  await page.mouse.click(
    bounds!.x + point.x,
    bounds!.y + point.y - group!.markerHeight + 12,
  )
}

async function openExternalLink(page: Page, link: Locator) {
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^https:\/\//u)
  if (process.env.RUN_EXTERNAL_AUDIT !== '1') {
    await page.context().route(href!, (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>External link audit stub</title>',
    }))
  }
  const popupPromise = page.context().waitForEvent('page')
  await link.click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined)
  const openedUrl = popup.url()
  expect(openedUrl).not.toBe('about:blank')
  await popup.close()
  if (process.env.RUN_EXTERNAL_AUDIT !== '1') {
    await page.context().unroute(href!)
  }
  return openedUrl
}

test('records a desktop user journey across every primary interaction', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  const runtime = monitorRuntime(page)
  const { record, finish } = await createRecorder(page, testInfo, 'desktop', runtime, 24)

  await page.goto('/')
  await record('landing-view', 'entry gate', 'landing content and entry call-to-action visible')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /展开诗卷/ })).toBeFocused()
  await record('keyboard-tab-on-landing', 'first focusable control', 'keyboard focus made visible')

  await page.getByRole('button', { name: /展开诗卷/ }).click()
  await waitForStableMap(page)
  await expect(page.locator('.geographic-map')).toHaveAttribute(
    'data-poem-density-policy',
    'progressive-disclosure',
  )
  await record('enter-experience', '展开诗卷', 'WebGL map, poem slip, controls, and audio state loaded')

  await clickPoemPlaceMarker(page, 'li-bai-baidi', 'baidicheng')
  await waitForStableMap(page)
  await expect(page.getByRole('heading', { name: '早发白帝城', exact: true })).toBeVisible()
  await record('select-single-map-marker', '白帝城地图诗签', 'single-place marker selected Li Bai and rendered its route')

  await page.getByRole('button', { name: '静音' }).click()
  await record('mute-audio', '静音', 'soundscape muted and control changed to restore action')
  await page.getByRole('button', { name: '打开声音' }).click()
  await record('restore-audio', '打开声音', 'soundscape restored')

  await page.getByRole('button', { name: '归正地图方向' }).click()
  await record('reset-map-bearing', '归正地图方向', 'map bearing reset without losing selected poem')

  // A same-place group is a distinct map interaction: select a known anchor
  // through the catalog, then use its visible marker and radial chooser.
  {
    const groupLibraryTrigger = page.getByRole('button', { name: /打开诗库/ })
    await groupLibraryTrigger.click()
    await record('open-library-for-place-group', '诗库', 'Tang catalog opened')
    const groupSearch = page.getByRole('searchbox', { name: '搜索当前时期的诗词' })
    await groupSearch.fill('鹿柴')
    await record('search-place-group-anchor', '诗库搜索', 'Lantian Wangchuan anchor found')
    await page.locator('[data-library-poem="school-e9b1a8b4def0"]').click()
    await record('select-place-group-anchor', '王维《鹿柴》', 'map focused the shared Wangchuan place')
    await page.locator('.poem-library > header button').click()
    await expect(groupLibraryTrigger).toBeFocused()
    await waitForStableMap(page)
    await record('close-library-for-map', '诗库关闭按钮', 'map interaction restored with trigger focus returned')
    await clickPoemPlaceMarker(page, 'school-e9b1a8b4def0', 'lantian-wangchuan')
    await expect(page.locator('.poem-group-picker')).toBeVisible()
    await record('open-same-place-picker', '辋川地图诗签', 'three Wangchuan poems offered as explicit choices')
    await page.getByRole('button', { name: '选择王维《山居秋暝》' }).click()
    await waitForStableMap(page)
    await expect(page.getByRole('heading', { name: '山居秋暝', exact: true })).toBeVisible()
    await record('choose-same-place-poem', '王维《山居秋暝》', 'radial choice selected the requested poem')
  }

  const periods = [
    ['pre-qin', '先秦'], ['han', '汉'], ['wei-jin', '魏晋'],
    ['southern-northern', '南北朝'], ['sui', '隋'], ['tang', '唐'],
    ['five-dynasties', '五代'], ['song', '宋'], ['yuan', '元'],
    ['ming', '明'], ['qing', '清'],
  ] as const
  for (const [id, label] of periods) {
    await page.locator(`.dynasty-nav [data-dynasty="${id}"]`).click()
    await waitForStableMap(page)
    await record(`period-${id}`, `时期 ${label}`, `${label} catalog and first poem loaded`)
  }

  const libraryTrigger = page.getByRole('button', { name: /打开诗库/ })
  await libraryTrigger.click()
  const search = page.getByRole('searchbox', { name: '搜索当前时期的诗词' })
  await expect(search).toBeFocused()
  await record('open-library', '诗库', 'Qing library drawer opened with search focus')

  const libraryClose = page.locator('.poem-library > header button')
  const sourceLink = page.locator('.library-evidence a')
  await libraryClose.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(sourceLink).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(libraryClose).toBeFocused()
  await search.focus()
  await record('trap-library-focus', '诗库对话框', 'Tab and Shift+Tab remained inside the modal drawer')

  await page.getByRole('button', { name: '小学', exact: true }).click()
  await record('filter-primary', '小学', 'catalog filtered to primary curriculum poems')
  await page.getByRole('button', { name: '初中', exact: true }).click()
  await record('filter-middle', '初中', 'catalog filtered to middle-school curriculum poems')
  await page.getByRole('button', { name: '全部', exact: true }).click()
  await record('filter-all', '全部', 'catalog restored to all Qing poems')

  await search.fill('不存在的诗')
  await record('search-empty-state', '诗库搜索', 'empty result guidance displayed')
  await search.fill('袁枚')
  await record('search-author', '诗库搜索', 'matching Yuan Mei works displayed')
  await page.locator('[data-library-poem="yuan-mei-moss"]').click()
  await record('select-poem-in-library', '袁枚《苔》', 'selected poem and evidence updated while drawer stayed open')

  const openedSourceUrl = await openExternalLink(page, sourceLink)
  await record('open-text-source', '文本来源', `opened external source target ${openedSourceUrl}`)

  await page.locator('.poem-library > header button').click()
  await expect(libraryTrigger).toBeFocused()
  await record('close-library-button', '诗库关闭按钮', 'drawer closed from explicit close control')

  const map = page.locator('.geographic-map')
  const mapBounds = await map.boundingBox()
  if (mapBounds) {
    await page.mouse.move(
      mapBounds.x + mapBounds.width / 2,
      mapBounds.y + mapBounds.height / 2,
    )
    await page.mouse.wheel(0, -850)
    await expect(map).not.toHaveClass(/map-wheel-zooming/, { timeout: 3_000 })
    await record('zoom-map-in', 'map wheel', 'poem slip remained visible while map focused inward')
    await page.mouse.wheel(0, 850)
    await expect(map).not.toHaveClass(/map-wheel-zooming/, { timeout: 3_000 })
    await record('zoom-map-out', 'map wheel', 'map returned toward the overview')
    await page.mouse.move(
      mapBounds.x + mapBounds.width / 2,
      mapBounds.y + mapBounds.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(
      mapBounds.x + mapBounds.width / 2 + 72,
      mapBounds.y + mapBounds.height / 2 + 36,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect(map).not.toHaveClass(/map-moving/, { timeout: 3_000 })
    await record('pan-map', 'map drag', 'terrain panned without losing the active poem or controls')
  }

  await libraryTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(search).toBeFocused()
  await record('open-library-keyboard', '诗库', 'drawer opened with Enter and search received focus')
  await page.keyboard.press('Escape')
  await expect(libraryTrigger).toBeFocused()
  await record('close-library-escape', 'Escape', 'drawer closed from keyboard')

  await libraryTrigger.click()
  await page.locator('.library-scrim').click({ position: { x: 24, y: 420 } })
  await expect(libraryTrigger).toBeFocused()
  await record('close-library-scrim', 'drawer backdrop', 'drawer closed by clicking outside')

  const openFreeMapUrl = await openExternalLink(
    page,
    page.getByRole('link', { name: 'OpenFreeMap', exact: true }),
  )
  await record('open-map-provider-attribution', 'OpenFreeMap', `opened ${openFreeMapUrl}`)
  const openStreetMapUrl = await openExternalLink(
    page,
    page.getByRole('link', { name: '© OpenStreetMap', exact: true }),
  )
  await record('open-map-data-attribution', '© OpenStreetMap', `opened ${openStreetMapUrl}`)

  await page.getByRole('link', { name: '诗云首页' }).click()
  await record('brand-home-link', '诗云首页', 'home anchor kept the application stable')

  const payload = await finish()
  assertJourney(payload)
})

test('records a mobile user journey, touch targets, and responsive states', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const runtime = monitorRuntime(page)
  const { record, finish } = await createRecorder(page, testInfo, 'mobile', runtime, 44)

  await page.goto('/')
  await record('landing-view', 'entry gate', 'mobile landing content fits the viewport')
  await page.getByRole('button', { name: /展开诗卷/ }).click()
  await waitForStableMap(page)
  await expect(page.locator('.geographic-map')).toHaveAttribute(
    'data-poem-density-policy',
    'progressive-disclosure',
  )
  await record('enter-experience', '展开诗卷', 'mobile map and poem slip loaded')

  await expect(page.locator('.season-switch')).toHaveCount(0)

  await page.locator('.dynasty-nav [data-dynasty="song"]').click()
  await waitForStableMap(page)
  await record('period-song', '宋', 'horizontal period navigation selected Song')

  await page.getByRole('button', { name: /打开诗库/ }).click()
  await record('open-library', '诗库', 'full-width mobile drawer opened')
  await page.getByRole('button', { name: '小学', exact: true }).click()
  await record('filter-primary', '小学', 'mobile catalog filtered')

  const search = page.getByRole('searchbox', { name: '搜索当前时期的诗词' })
  await search.fill('苏轼')
  await record('search-author', '诗库搜索', 'Su Shi results displayed')
  const firstResult = page.locator('[data-library-poem]').first()
  const firstResultId = await firstResult.getAttribute('data-library-poem')
  await firstResult.click()
  await expect(page.locator('.poem-library')).toHaveCount(0)
  const mobileLibraryTrigger = page.getByRole('button', { name: /打开诗库/ })
  await expect(mobileLibraryTrigger).toBeFocused()
  await record('select-result', firstResultId ?? 'first result', 'poem selected and mobile drawer closed')

  await page.getByRole('button', { name: /打开诗库/ }).click()
  await search.fill('完全无结果')
  await record('search-empty-state', '诗库搜索', 'mobile empty state displayed')
  await page.keyboard.press('Escape')
  await expect(mobileLibraryTrigger).toBeFocused()
  await record('close-library-escape', 'Escape', 'mobile drawer closed')

  await page.locator('.dynasty-nav [data-dynasty="qing"]').click()
  await waitForStableMap(page)
  await record('period-qing', '清', 'mobile period navigation selected Qing')
  await page.getByRole('button', { name: /打开诗库/ }).click()
  await page.locator('.poem-library > header button').click()
  await expect(mobileLibraryTrigger).toBeFocused()
  await record(
    'close-library-button',
    '诗库关闭按钮',
    'full-width mobile drawer has no outside target and closed from its visible button',
  )

  await page.setViewportSize({ width: 844, height: 390 })
  await record('landscape-rotation', 'viewport', 'landscape layout captured for overflow review')
  await page.setViewportSize({ width: 390, height: 844 })
  await record('portrait-restored', 'viewport', 'portrait layout restored')

  const payload = await finish()
  assertJourney(payload)
})
