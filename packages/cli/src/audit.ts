import { createRequire } from 'node:module'
import { runRules, score, type Finding, type ScreenModel } from '@dualkit/rules'
import { chromium, type Browser, type Page } from 'playwright'
import { UserError, type Config } from './config'

export type AuditOptions = { url: string; width: number; height: number; config: Config }
export type AuditResult = {
  url: string; date: string; width: number; height: number
  score: number; findings: Finding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number
}

// Browser-side globals: the CLI tsconfig has no DOM lib, and these only run inside the page.
declare const document: { documentElement: { scrollHeight: number } }
type PageReader = { readScreen: (d: unknown, o: { exclude: string[] }) => ScreenModel }

const READER = createRequire(import.meta.url).resolve('@dualkit/rules/reader')
const SETTLE_MS = 800
const LOAD_WAIT_MS = 10_000
const MAX_SHOT_HEIGHT = 8000
const HTTP_ERROR = 400
export const PLAYWRIGHT_VERSION = '1.55.0'

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? ''

async function open(launch: () => Promise<Browser>): Promise<Browser> {
  try {
    return await launch()
  } catch (e) {
    const missing = e instanceof Error && /Executable doesn't exist|download new browsers|playwright install/i.test(e.message)
    throw new UserError(missing
      ? `Chromium is not installed. Run: npx playwright@${PLAYWRIGHT_VERSION} install chromium`
      : `Could not start Chromium: ${firstLine(e)}`)
  }
}

// Playwright's own screenshot waits on pending subresources and times out when one never answers,
// so ask Chromium for the pixels directly. The viewport stays at the size the model was read at:
// growing it to the page height would stretch min-height:100vh sections and move every box, so
// captureBeyondViewport paints the rest of the page at the same layout instead. A page that fits
// the viewport is captured without it: Chromium shifts an RTL page's inline end out of the clip then.
async function capture(page: Page, width: number, height: number, viewportHeight: number): Promise<Buffer> {
  const cdp = await page.context().newCDPSession(page)
  try {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: height > viewportHeight, clip: { x: 0, y: 0, width, height, scale: 1 },
    })
    return Buffer.from(data, 'base64')
  } finally {
    await cdp.detach().catch(() => {})
  }
}

async function read(page: Page, options: AuditOptions): Promise<{ model: ScreenModel; pageHeight: number; shot: Buffer }> {
  try {
    await page.addScriptTag({ path: READER })
    const model = await page.evaluate(
      (exclude) => (globalThis as unknown as { dualkitReader: PageReader }).dualkitReader.readScreen(document, { exclude }),
      options.config.exclude,
    )
    const pageHeight = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight))
    const shot = await capture(page, options.width, pageHeight, options.height)
    return { model, pageHeight, shot }
  } catch (e) {
    throw new UserError(`Could not read ${options.url}: ${firstLine(e)}`)
  }
}

export async function audit(options: AuditOptions, launch: () => Promise<Browser> = () => chromium.launch()): Promise<AuditResult> {
  const browser = await open(launch)
  try {
    // bypassCSP: a strict script-src would otherwise block the injected reader.
    const context = await browser.newContext({ viewport: { width: options.width, height: options.height }, bypassCSP: true })
    const page = await context.newPage()
    let status = 0
    try {
      // domcontentloaded, then a bounded wait for `load`: a hung image or font must not fail the audit.
      status = (await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30_000 }))?.status() ?? 0
    } catch (e) {
      throw new UserError(`Could not open ${options.url}: ${firstLine(e)}`)
    }
    // An error page is not the screen the user asked about, so scoring it would mislead.
    if (status >= HTTP_ERROR) throw new UserError(`${options.url} returned ${status}.`)
    await page.waitForLoadState('load', { timeout: LOAD_WAIT_MS }).catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    const { model, pageHeight, shot } = await read(page, options)
    const findings = runRules(model, { ignore: options.config.ignore })
    return {
      url: options.url, date: new Date().toISOString(), width: options.width, height: options.height,
      score: score(findings), findings, screenshot: shot.toString('base64'), pageHeight,
      unreadableStylesheets: model.unreadableStylesheets,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}
