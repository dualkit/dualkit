import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RULES } from '@dualkit/rules'
import { chromium, type Browser, type Page } from 'playwright'
// The CLI publishes only its binary, so the bench imports the audit from source, the same code `dualkit check` runs.
import { audit } from '../../cli/src/audit'
import { RUN, type RequiredPart } from './config'

export type SlimFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type Scored =
  | { ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[]; screenshot: string; pageHeight: number }
  | { ok: false; error: string }

export const RULE_COUNT = RULES.length
const GOTO_MS = 30_000
const LOAD_MS = 10_000
const SETTLE_MS = 800

export async function missingParts(page: Page, required: readonly RequiredPart[]): Promise<string[]> {
  return page.evaluate((parts) => {
    const text = document.body?.innerText ?? ''
    return parts.filter((p) => {
      const bySelector = p.selector ? document.querySelectorAll(p.selector).length >= (p.min ?? 1) : true
      const byText = p.text ? new RegExp(p.text).test(text) : true
      return !(bySelector && byText)
    }).map((p) => p.label)
  }, [...required])
}

async function checkRequired(browser: Browser, url: string, required: readonly RequiredPart[]): Promise<string[]> {
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
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

export async function scoreHtml(html: string, required: readonly RequiredPart[], opts: { browser?: Browser } = {}): Promise<Scored> {
  const dir = mkdtempSync(join(tmpdir(), 'bench-build-'))
  const file = join(dir, 'index.html')
  writeFileSync(file, html)
  const url = pathToFileURL(file).href
  const own = opts.browser ? null : await chromium.launch()
  const browser = opts.browser ?? own!
  try {
    // audit() closes the browser it launches, so it gets its own; the shared one stays for the required parts.
    const result = await audit({ url, width: RUN.width, height: RUN.height, config: { ignore: [], exclude: [] } })
    const missing = await checkRequired(browser, url, required)
    const findings: SlimFinding[] = result.findings.map((f) => ({
      rule: f.rule, title: f.title, severity: f.severity,
      box: f.node ? { x: f.node.box.x, y: f.node.box.y, width: f.node.box.width, height: f.node.box.height } : null,
    }))
    return {
      ok: true, rulesPassed: RULE_COUNT - new Set(findings.map((f) => f.rule)).size, score: result.score,
      missing, findings, screenshot: result.screenshot, pageHeight: result.pageHeight,
    }
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? 'Render failed' }
  } finally {
    await own?.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  }
}
