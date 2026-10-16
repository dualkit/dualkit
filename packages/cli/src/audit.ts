import { createRequire } from 'node:module'
import { runRules, score, type Finding, type ScreenModel } from '@dualkit/rules'
import { chromium, type Browser } from 'playwright'
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
const MAX_SHOT_HEIGHT = 8000
export const PLAYWRIGHT_VERSION = '1.55.0'

async function open(launch: () => Promise<Browser>): Promise<Browser> {
  try {
    return await launch()
  } catch (e) {
    const missing = e instanceof Error && /Executable doesn't exist|browserType\.launch/.test(e.message)
    throw new UserError(missing
      ? `Chromium is not installed. Run: npx playwright@${PLAYWRIGHT_VERSION} install chromium`
      : `Could not start Chromium: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function audit(options: AuditOptions, launch: () => Promise<Browser> = () => chromium.launch()): Promise<AuditResult> {
  const browser = await open(launch)
  try {
    const page = await browser.newPage({ viewport: { width: options.width, height: options.height } })
    try {
      // `load`, not `networkidle`: pages that poll or stream never go idle.
      await page.goto(options.url, { waitUntil: 'load', timeout: 30_000 })
    } catch (e) {
      throw new UserError(`Could not open ${options.url}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    }
    await page.waitForTimeout(SETTLE_MS)
    await page.addScriptTag({ path: READER })
    const model = await page.evaluate(
      (exclude) => (globalThis as unknown as { dualkitReader: PageReader }).dualkitReader.readScreen(document, { exclude }),
      options.config.exclude,
    )
    const findings = runRules(model, { ignore: options.config.ignore })
    const pageHeight = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight))
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: options.width, height: pageHeight }, fullPage: true })
    return {
      url: options.url, date: new Date().toISOString(), width: options.width, height: options.height,
      score: score(findings), findings, screenshot: shot.toString('base64'), pageHeight,
      unreadableStylesheets: model.unreadableStylesheets,
    }
  } finally {
    await browser.close()
  }
}
