import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lintText } from '@dualkit/lint'
import { chromium, type Browser } from 'playwright'
import { parse } from 'node-html-parser'
import { RUN } from '@dualkit/bench/src/config'
import { scoreHtml, type Scored } from '@dualkit/bench/src/score'
import { applyEdits, retag } from './inject-html.js'
import { INJECTORS, type BugKind } from './inject.js'
import type { CaseResult } from './types.js'

export type MissCase = { id: string; kind: BugKind | 'real'; base: string; html: string }
export type Dropped = { id: string; why: string }

export const MARKER = 'data-eval-bug'
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
export const FROZEN_FILE = fileURLToPath(new URL('../cases/miss-set-2026-10.json', import.meta.url))
const REAL_FILE = fileURLToPath(new URL('../cases/real.json', import.meta.url))
/**
 * Kinds exempt from the identical-screenshot drop, because Chromium's render cannot show them.
 * otp-digits: behavioural, the page looks the same until someone types Arabic digits.
 * arabic-tracking: Chromium skips letter-spacing on connected Arabic, but Safari and Firefox apply it and break the joins.
 */
export const BEHAVIOURAL_OR_ENGINE_KINDS: ReadonlySet<string> = new Set(['otp-digits', 'arabic-tracking'])
const CACHE_PAGES = 200
const SNIPPET_MARKER = new RegExp(`\\s*${MARKER}="[^"]*"`, 'g')

/** One planted-bug case, kept as the bug kind and the page it goes into (a path under the repo root). */
export type FrozenCase = { kind: BugKind; page: string }

type RealEntry = { id: string; base: string; bugged: string; selector: string }

// One browser for the whole run; callers close it with closeBrowser().
// The launch itself is shared: checkCaught scores two pages at once, and two callers that each saw no browser and
// launched their own left one open, which kept the process alive after the report printed.
let browser: Promise<Browser> | null = null
const scored = new Map<string, Promise<Scored>>()

/** The run's browser, launched once however many callers ask at the same time. A failed launch is not kept. */
export function sharedBrowser(launch: () => Promise<Browser> = () => chromium.launch()): Promise<Browser> {
  browser ??= launch().catch((e: unknown) => {
    browser = null
    throw e
  })
  return browser
}

export async function closeBrowser(): Promise<void> {
  const b = browser
  browser = null
  scored.clear()
  boxes.clear()
  const open = await b?.catch(() => null)
  await open?.close().catch(() => {})
}

/** Renders a page at 390x844 and returns what check reports, once per distinct page. */
export function scorePage(html: string): Promise<Scored> {
  const known = scored.get(html)
  if (known) return known
  const run = (async () => {
    return scoreHtml(html, [], { browser: await sharedBrowser() })
  })()
  if (scored.size >= CACHE_PAGES) scored.delete(scored.keys().next().value as string)
  scored.set(html, run)
  return run
}

function walkHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walkHtml(path) : name.endsWith('.html') ? [path] : []
  })
}

type StoredRecord = { ok?: unknown; missing?: unknown; findings?: unknown }

function isClean(record: StoredRecord): boolean {
  if (record.ok !== true || !Array.isArray(record.missing) || record.missing.length > 0) return false
  if (!Array.isArray(record.findings)) return false
  return record.findings.every((f: { severity?: string }) => f.severity === 'note')
}

const modelOf = (runs: string, page: string): string => relative(runs, page).split(sep)[0] ?? ''

/** Clean pages, one model at a time in turn (each model's pages sorted), so early cases spread across models. */
export function roundRobin(runs: string, pages: readonly string[]): string[] {
  const byModel = new Map<string, string[]>()
  for (const page of [...pages].sort()) byModel.set(modelOf(runs, page), [...(byModel.get(modelOf(runs, page)) ?? []), page])
  const queues = [...byModel.keys()].sort().map((m) => byModel.get(m)!)
  const out: string[] = []
  for (let i = 0; queues.some((q) => i < q.length); i += 1) for (const q of queues) if (i < q.length) out.push(q[i]!)
  return out
}

/** Final pages whose stored record is ok, complete and free of warnings and errors, taken round-robin by model. */
export function basePages(runs: string): string[] {
  return roundRobin(runs, walkHtml(runs)
    .filter((page) => {
      const record = page.replace(/\.html$/, '.json')
      return existsSync(record) && isClean(JSON.parse(readFileSync(record, 'utf8')) as StoredRecord)
    }))
}

const baseOf = (page: string): string => relative(REPO_ROOT, resolve(page))

type BuildOpts = {
  /** What a page looks like, as a string that is equal exactly when the renders are equal. Defaults to the real screenshot. */
  render?: (html: string) => Promise<string>
  /** A fixed case list. When set, exactly these pages are used in this order, and the pages argument and the render check are skipped. */
  frozen?: readonly FrozenCase[]
  /** Real misses to add. Defaults to cases/real.json. */
  real?: readonly RealEntry[]
}

async function screenshotOf(html: string): Promise<string> {
  const s = await scorePage(html)
  if (!s.ok) throw new Error(s.error)
  return s.screenshot
}

export function loadReal(file: string = REAL_FILE): RealEntry[] {
  return JSON.parse(readFileSync(file, 'utf8')) as RealEntry[]
}

export function loadFrozenCases(file: string = FROZEN_FILE): FrozenCase[] {
  return JSON.parse(readFileSync(file, 'utf8')) as FrozenCase[]
}

/** The frozen form of a built case list: bug kind and page, without the real misses. */
export function freezeCases(cases: readonly MissCase[]): FrozenCase[] {
  return cases.flatMap((c) => (c.kind === 'real' ? [] : [{ kind: c.kind, page: c.base }]))
}

function frozenCases(frozen: readonly FrozenCase[]): MissCase[] {
  return frozen.map(({ kind, page }) => {
    const path = resolve(REPO_ROOT, page)
    if (!existsSync(path)) throw new Error(`Frozen page not found: ${page}`)
    const injector = INJECTORS.find((i) => i.kind === kind)
    if (!injector) throw new Error(`Frozen case has an unknown bug kind: ${kind}`)
    const html = injector.inject(readFileSync(path, 'utf8'))
    if (html === null) throw new Error(`Frozen page no longer fits ${kind}: ${page}`)
    return { id: `${kind}:${baseOf(path)}`, kind, base: baseOf(path), html }
  })
}

/** The bugged page with the marker added as the first attribute of the element the selector finds. */
export function markSelector(html: string, selector: string): string {
  const el = parse(html).querySelector(selector)
  if (!el) throw new Error(`No element matches ${selector}`)
  return applyEdits(html, retag(html, el, 'real'))
}

function realCases(real: readonly RealEntry[] = loadReal()): MissCase[] {
  return real.map((r) => ({
    id: `real:${r.id}`, kind: 'real', base: r.base,
    html: markSelector(readFileSync(resolve(REPO_ROOT, r.bugged), 'utf8'), r.selector),
  }))
}

/** At most one case per kind per page, in page order, until a kind has perKind cases that change the render. */
export async function buildCases(pages: string[], perKind: number, opts: BuildOpts = {}): Promise<{ cases: MissCase[]; dropped: Dropped[] }> {
  if (opts.frozen) return { cases: [...frozenCases(opts.frozen), ...realCases(opts.real)], dropped: [] }
  const render = opts.render ?? screenshotOf
  const clean = new Map<string, string>()
  const cleanLook = async (page: string, html: string): Promise<string> => {
    const known = clean.get(page)
    if (known !== undefined) return known
    const look = await render(html)
    clean.set(page, look)
    return look
  }
  const cases: MissCase[] = []
  const dropped: Dropped[] = []
  for (const injector of INJECTORS) {
    let kept = 0
    for (const page of pages) {
      if (kept >= perKind) break
      const html = readFileSync(page, 'utf8')
      const bugged = injector.inject(html)
      if (bugged === null) continue
      const id = `${injector.kind}:${baseOf(page)}`
      try {
        if (!BEHAVIOURAL_OR_ENGINE_KINDS.has(injector.kind) && (await render(bugged)) === (await cleanLook(page, html))) {
          dropped.push({ id, why: 'renders the same as the clean page' })
          continue
        }
      } catch (e) {
        dropped.push({ id, why: `render failed: ${e instanceof Error ? e.message : String(e)}` })
        continue
      }
      cases.push({ id, kind: injector.kind, base: baseOf(page), html: bugged })
      kept += 1
    }
    if (kept < perKind) dropped.push({ id: injector.kind, why: `fewer than ${perKind} pages fit: ${kept}` })
  }
  return { cases: [...cases, ...realCases(opts.real)], dropped }
}

const stripMarker = (text: string): string => text.replace(SNIPPET_MARKER, '')
const counts = (keys: readonly string[]): Map<string, number> =>
  keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())
/** Keys in the bugged list that appear more often than in the clean list, and satisfy the filter. */
const newKeys = (bugged: readonly string[], clean: readonly string[]): string[] => {
  const before = counts(clean)
  const seen = new Map<string, number>()
  return bugged.filter((k) => {
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    return n > (before.get(k) ?? 0)
  })
}

type Scorer = (html: string) => Promise<Scored>
export type Box = { x: number; y: number; width: number; height: number }
type BoxOf = (html: string) => Promise<Box | null>
export type Deps = { score?: Scorer; box?: BoxOf }

const boxes = new Map<string, Promise<Box | null>>()
const SETTLE_MS = 800

/** Where the marked element renders, read from a render set up like the audit's (same viewport, load and settle). */
export function markedBox(html: string): Promise<Box | null> {
  const known = boxes.get(html)
  if (known) return known
  const run = (async () => {
    const shared = await sharedBrowser()
    const dir = mkdtempSync(join(tmpdir(), 'eval-box-'))
    const context = await shared.newContext({ viewport: { width: RUN.width, height: RUN.height } })
    try {
      const file = join(dir, 'index.html')
      writeFileSync(file, html)
      const page = await context.newPage()
      await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(SETTLE_MS)
      return await page.evaluate((marker) => {
        const el = document.querySelector(`[${marker}]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }
      }, MARKER)
    } finally {
      await context.close().catch(() => {})
      rmSync(dir, { recursive: true, force: true })
    }
  })()
  if (boxes.size >= CACHE_PAGES) boxes.delete(boxes.keys().next().value as string)
  boxes.set(html, run)
  return run
}

type Hit = { rule: string; snippet: string | null; box: Box | null }
const MARKED_FIRST_TAG = /^<[^>]*data-eval-bug/
const BOX_SLACK = 1

/** The same rule on the same element: snippets compared with the marker removed, both cut to the shorter, since a snippet is cut at a fixed length and the marker pushes the cut earlier. */
function sameFinding(a: Hit, b: Hit): boolean {
  if (a.rule !== b.rule) return false
  const x = stripMarker(a.snippet ?? '')
  const y = stripMarker(b.snippet ?? '')
  const n = Math.min(x.length, y.length)
  return x.slice(0, n) === y.slice(0, n)
}

/** Findings of the bugged page that the clean page does not already have, each clean finding used once. */
function newFindings(bugged: readonly Hit[], clean: readonly Hit[]): Hit[] {
  const free = [...clean]
  return bugged.filter((f) => {
    const i = free.findIndex((c) => sameFinding(f, c))
    if (i === -1) return true
    free.splice(i, 1)
    return false
  })
}

const inside = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x - BOX_SLACK && inner.y >= outer.y - BOX_SLACK &&
  inner.x + inner.width <= outer.x + outer.width + BOX_SLACK && inner.y + inner.height <= outer.y + outer.height + BOX_SLACK &&
  inner.width * inner.height < outer.width * outer.height - BOX_SLACK

/** Check found it: a new warning or error on the marked element (marker in the snippet's first tag) or on a descendant (box strictly inside the marked element's box). */
export async function checkCaught(bugged: string, clean: string, deps: Deps = {}): Promise<boolean> {
  const score = deps.score ?? scorePage
  const [b, c] = await Promise.all([score(bugged), score(clean)])
  if (!b.ok) return false
  const loud = (r: Scored): Hit[] => (r.ok ? r.findings.filter((f) => f.severity !== 'note') : [])
  const fresh = newFindings(loud(b), loud(c))
  if (fresh.some((f) => MARKED_FIRST_TAG.test(f.snippet ?? ''))) return true
  const marked = await (deps.box ?? markedBox)(bugged)
  return marked !== null && fresh.some((f) => f.box !== null && inside(f.box, marked))
}

/** Lint found it: a new warning or error on a line that holds the marker. */
export function lintCaught(bugged: string, clean: string): boolean {
  const lines = bugged.split('\n')
  const loud = (html: string) => lintText('page.html', html).filter((f) => f.severity !== 'note')
  const key = (f: { rule: string; line: number }) => JSON.stringify([f.rule, f.line])
  const b = loud(bugged)
  const sameLines = clean.split('\n').length === lines.length
  // A change that adds or removes lines moves every finding below it, so fall back to counting per rule.
  const keyOf = sameLines ? key : (f: { rule: string }) => JSON.stringify([f.rule])
  const fresh = new Set(newKeys(b.map(keyOf), loud(clean).map(keyOf)))
  return b.some((f) => (lines[f.line - 1] ?? '').includes(MARKER) && fresh.has(keyOf(f)))
}

/** True when the marked element shares its line with other markup, so lint cannot be pinned to it. */
export function sharedLine(html: string): boolean {
  const line = html.split('\n').find((l) => l.includes(MARKER)) ?? ''
  return (line.match(/<[a-zA-Z]/g) ?? []).length > 1
}

/** What a real-world miss is compared with: nothing. Its base page was an earlier draft with its own warnings. */
export const EMPTY_PAGE = '<!doctype html><html><body></body></html>'

export async function runCase(c: MissCase, clean: string, deps: Deps = {}): Promise<CaseResult[]> {
  const against = c.kind === 'real' ? EMPTY_PAGE : clean
  const result = (tool: CaseResult['tool'], caught: boolean): CaseResult => ({ id: c.id, kind: c.kind, tool, caught })
  return [result('check', await checkCaught(c.html, against, deps)), result('lint', lintCaught(c.html, against))]
}
