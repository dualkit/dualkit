import { createRequire } from 'node:module'
import { runRules, score, wantsDigitProbe, type Finding, type ScreenModel } from '@dualkit/rules'
import { chromium, type Browser, type Page } from 'playwright'
import { UserError, type Config } from './config'
import { markDroppedDigits, probeArabicDigits } from './probe'

export type AuditOptions = { url: string; width: number; height: number; config: Config }
export type AuditResult = {
  url: string; date: string; width: number; height: number
  score: number; findings: Finding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number
}

// Browser-side globals: the CLI tsconfig has no DOM lib, and these only run inside the page.
declare const document: { documentElement: { scrollHeight: number }; fonts: { ready: Promise<unknown> } }
type PageReader = { readScreen: (d: unknown, o: { exclude: string[] }) => ScreenModel }

const READER = createRequire(import.meta.url).resolve('@dualkit/rules/reader')
const SETTLE_MS = 800
const LOAD_WAIT_MS = 10_000
export const FONT_WAIT_MS = 3000

/** Waits for web fonts so a read does not race them. Never throws and gives up after FONT_WAIT_MS. */
const waitForFonts = async (page: Page): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((r) => { timer = setTimeout(r, FONT_WAIT_MS) })
  try {
    await Promise.race([page.evaluate(() => document.fonts.ready).then(() => undefined, () => undefined), timeout])
  } finally {
    clearTimeout(timer)
  }
}
const MAX_SHOT_HEIGHT = 8000
/** Device pixels: a 2x capture is used while it stays this tall, so zoomed crops stay sharp and the PNG stays a sensible size. */
const MAX_2X_DEVICE_HEIGHT = 8000
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
/** 2 for pages short enough to capture at double density, 1 otherwise. Boxes stay in CSS pixels either way. */
export const shotScale = (pageHeight: number): 1 | 2 => (pageHeight * 2 <= MAX_2X_DEVICE_HEIGHT ? 2 : 1)

async function capture(page: Page, width: number, height: number, viewportHeight: number): Promise<Buffer> {
  const cdp = await page.context().newCDPSession(page)
  try {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: height > viewportHeight, clip: { x: 0, y: 0, width, height, scale: shotScale(height) },
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
    await waitForFonts(page)
    await page.waitForTimeout(SETTLE_MS)
    const { model: seen, pageHeight, shot } = await read(page, options)
    // After the read and the screenshot, so typing cannot change what they show. Only when the rule can fire, since
    // this types into the live page.
    const probed = wantsDigitProbe(seen, options.config.ignore) ? await probeArabicDigits(page, seen.fields) : new Map<string, boolean>()
    const model = { ...seen, fields: markDroppedDigits(seen.fields, probed) }
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
