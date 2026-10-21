import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RULES } from '@dualkit/rules'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
// The CLI publishes only its binary, so the bench imports the audit from source, the same code `dualkit check` runs.
import { audit } from '../../cli/src/audit'
import { RUN, type RequiredPart } from './config'

export type SlimFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null; message: string; fix: string; snippet: string | null }
export type Scored =
  | { ok: true; rulesPassed: number; score: number; missing: string[]; text: string; findings: SlimFinding[]; screenshot: string; pageHeight: number; unreadableStylesheets: number }
  | { ok: false; error: string }

export const RULE_COUNT = RULES.length
/** Distinct rules with a warning or error; notes never count as failed. */
export const failedRules = (findings: readonly { rule: string; severity: string }[]) => [...new Set(findings.filter((f) => f.severity !== 'note').map((f) => f.rule))]
export const SCORE_DEADLINE_MS = 90_000
const GOTO_MS = 30_000
const LOAD_MS = 10_000
const SETTLE_MS = 800
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

// Written as escapes on purpose: these are invisible or look like their ASCII twins.
const BIDI_CONTROLS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g
const ARABIC_INDIC = /[\u0660-\u0669]/g
const PERSIAN = /[\u06F0-\u06F9]/g
const ARABIC_THOUSANDS = /\u066C/g
const ARABIC_DECIMAL = /\u066B/g

/** A faithful Arabic page may write 1,234 as Arabic-Indic digits, with Arabic separators and bidi isolates; the patterns see plain ASCII. */
export function normaliseText(text: string): string {
  return text
    .replace(BIDI_CONTROLS, '')
    .replace(ARABIC_INDIC, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30))
    .replace(PERSIAN, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 0x30))
    .replace(ARABIC_THOUSANDS, ',')
    .replace(ARABIC_DECIMAL, '.')
}

/** The visible text plus what every input and textarea holds, since a read-only field is a common way to show an IBAN or phone. */
async function pageText(page: Page): Promise<string> {
  const body = await page.locator('body').innerText()
  const fields = await page.locator('css=input, textarea').all()
  const values = await Promise.all(fields.map((f) => f.inputValue().catch(() => '')))
  return normaliseText([body, ...values].join('\n'))
}

export async function missingParts(page: Page, required: readonly RequiredPart[]): Promise<string[]> {
  return (await readParts(page, required)).missing
}

async function readParts(page: Page, required: readonly RequiredPart[]): Promise<{ missing: string[]; text: string }> {
  // Locators, innerText and inputValue run in Playwright's isolated world and the regex runs in Node, so a page cannot patch its way past the check.
  const text = await pageText(page)
  const missing: string[] = []
  for (const p of required) {
    const bySelector = p.selector ? (await page.locator(`css=${p.selector}`).count()) >= (p.min ?? 1) : true
    const byText = p.text ? new RegExp(p.text).test(text) : true
    if (!(bySelector && byText)) missing.push(p.label)
  }
  return { missing, text }
}

async function checkRequired(browser: Browser, url: string, required: readonly RequiredPart[], contexts: BrowserContext[]): Promise<{ missing: string[]; text: string }> {
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
  contexts.push(context)
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_MS })
    await page.waitForLoadState('load', { timeout: LOAD_MS }).catch(() => {})
    await waitForFonts(page)
    await page.waitForTimeout(SETTLE_MS)
    return await readParts(page, required)
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
      const { missing, text } = await checkRequired(shared, url, required, contexts)
      const findings: SlimFinding[] = result.findings.map((f) => ({
        rule: f.rule, title: f.title, severity: f.severity,
        box: f.node ? { x: f.node.box.x, y: f.node.box.y, width: f.node.box.width, height: f.node.box.height } : null,
        message: f.message, fix: f.fix, snippet: f.node?.snippet ?? null,
      }))
      return {
        ok: true, rulesPassed: RULE_COUNT - failedRules(findings).length, score: result.score,
        missing, text, findings, screenshot: result.screenshot, pageHeight: result.pageHeight, unreadableStylesheets: result.unreadableStylesheets,
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
