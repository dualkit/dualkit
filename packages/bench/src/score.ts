import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RULES } from '@dualkit/rules'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
// The CLI publishes only its binary, so the bench imports the audit from source, the same code `dualkit check` runs.
import { audit } from '../../cli/src/audit'
import { RUN, type RequiredPart } from './config'

export type SlimFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type Scored =
  | { ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number }
  | { ok: false; error: string }

export const RULE_COUNT = RULES.length
export const SCORE_DEADLINE_MS = 90_000
const GOTO_MS = 30_000
const LOAD_MS = 10_000
const SETTLE_MS = 800

export async function missingParts(page: Page, required: readonly RequiredPart[]): Promise<string[]> {
  // Locators and innerText run in Playwright's isolated world and the regex runs in Node, so a page cannot patch its way past the check.
  const text = await page.locator('body').innerText()
  const missing: string[] = []
  for (const p of required) {
    const bySelector = p.selector ? (await page.locator(`css=${p.selector}`).count()) >= (p.min ?? 1) : true
    const byText = p.text ? new RegExp(p.text).test(text) : true
    if (!(bySelector && byText)) missing.push(p.label)
  }
  return missing
}

async function checkRequired(browser: Browser, url: string, required: readonly RequiredPart[], contexts: BrowserContext[]): Promise<string[]> {
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
  contexts.push(context)
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS })
    await page.waitForLoadState('load', { timeout: LOAD_MS }).catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    return await missingParts(page, required)
  } finally {
    await context.close().catch(() => {})
  }
}

type ScoreOpts = { browser?: Browser; launch?: () => Promise<Browser>; deadlineMs?: number }
const TIMED_OUT = Symbol('timed out')

export async function scoreHtml(html: string, required: readonly RequiredPart[], opts: ScoreOpts = {}): Promise<Scored> {
  const launch = opts.launch ?? (() => chromium.launch())
  let dir: string | null = null
  let own: Browser | null = null
  let auditBrowser: Browser | null = null
  const contexts: BrowserContext[] = []
  let timer: NodeJS.Timeout | undefined
  try {
    dir = mkdtempSync(join(tmpdir(), 'bench-build-'))
    const file = join(dir, 'index.html')
    writeFileSync(file, html)
    const url = pathToFileURL(file).href
    const work = (async (): Promise<Scored> => {
      const shared = opts.browser ?? (own = await launch())
      // audit() closes the browser it launches, so it gets its own; the shared one stays for the required parts.
      const result = await audit(
        { url, width: RUN.width, height: RUN.height, config: { ignore: [], exclude: [] } },
        async () => (auditBrowser = await launch()),
      )
      const missing = await checkRequired(shared, url, required, contexts)
      const findings: SlimFinding[] = result.findings.map((f) => ({
        rule: f.rule, title: f.title, severity: f.severity,
        box: f.node ? { x: f.node.box.x, y: f.node.box.y, width: f.node.box.width, height: f.node.box.height } : null,
      }))
      return {
        ok: true, rulesPassed: RULE_COUNT - new Set(findings.map((f) => f.rule)).size, score: result.score,
        missing, findings, screenshot: result.screenshot, pageHeight: result.pageHeight, unreadableStylesheets: result.unreadableStylesheets,
      }
    })()
    const deadline = new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), opts.deadlineMs ?? SCORE_DEADLINE_MS) })
    const outcome = await Promise.race([work, deadline])
    if (outcome === TIMED_OUT) {
      work.catch(() => {}) // the work is torn down in finally; its late rejection is expected
      return { ok: false, error: 'Scoring timed out' }
    }
    return outcome
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? 'Render failed' }
  } finally {
    clearTimeout(timer)
    await Promise.all(contexts.map((c) => c.close().catch(() => {})))
    await (auditBrowser as Browser | null)?.close().catch(() => {})
    await (own as Browser | null)?.close().catch(() => {})
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
}
