import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { lint } from '@dualkit/lint'
import type { Label, Tally } from './types.js'

export type SweepProduct = { tool: 'check' | 'lint'; name: string }

export type RunFinding = {
  rule: string
  severity: string
  file?: string
  line?: number
  snippet?: string | null
}

export type ProductScore = {
  byRule: Record<string, Tally>
  notes: number
  noteTally: Tally
  lost: string[]
  findings: number
  unlabelled: number
}

const SNIPPET_CHARS = 100
const VIEWPORT = { width: 1280, height: 800 }
const EMPTY: Tally = { real: 0, handled: 0, intended: 0, unclear: 0 }
const LABELS: readonly Label[] = ['real', 'handled', 'intended', 'unclear']
const LINT_HEADING = /^### (\S+) (\S+) (.+):(\d+)$/gm
const SNIPPET_LINE = /^snippet: `(.*)`$/m

const labelFile = (data: string, p: SweepProduct): string =>
  join(data, 'labels', p.tool === 'lint' ? `${p.name}.json` : `check-${p.name}.json`)
const sampleFile = (data: string, p: SweepProduct): string =>
  join(data, p.tool === 'lint' ? 'samples' : 'csamples', `${p.name}.md`)

/** Every product that has a label file, split into scorable ones and ones missing a sample file. */
export function listProducts(data: string): { products: SweepProduct[]; skipped: { tool: 'check' | 'lint'; name: string; why: string }[] } {
  const files = readdirSync(join(data, 'labels')).filter((f) => f.endsWith('.json')).sort()
  const products: SweepProduct[] = []
  const skipped: { tool: 'check' | 'lint'; name: string; why: string }[] = []
  for (const f of files) {
    const base = f.slice(0, -'.json'.length)
    const product: SweepProduct = base.startsWith('check-') ? { tool: 'check', name: base.slice('check-'.length) } : { tool: 'lint', name: base }
    if (existsSync(sampleFile(data, product))) products.push(product)
    else skipped.push({ tool: product.tool, name: product.name, why: `no sample file at ${product.tool === 'lint' ? 'samples' : 'csamples'}/${product.name}.md` })
  }
  return { products, skipped }
}

const lintKey = (rule: string, file: string, line: number): string => JSON.stringify([rule, file, line])
const checkKey = (rule: string, snippet: string): string => JSON.stringify([rule, snippet.slice(0, SNIPPET_CHARS)])

function sampleKeys(data: string, p: SweepProduct): Map<string, string> {
  const md = readFileSync(sampleFile(data, p), 'utf8')
  const keys = new Map<string, string>()
  if (p.tool === 'lint') {
    for (const m of md.matchAll(LINT_HEADING)) keys.set(m[1]!, lintKey(m[2]!, m[3]!, Number(m[4])))
    return keys
  }
  for (const block of md.split('\n## ').slice(1)) {
    const head = (block.split('\n', 1)[0] ?? '').split(/\s+/)
    keys.set(head[0]!, checkKey(head[1] ?? '', SNIPPET_LINE.exec(block)?.[1] ?? ''))
  }
  return keys
}

const runKey = (p: SweepProduct, f: RunFinding): string =>
  p.tool === 'lint' ? lintKey(f.rule, f.file ?? '', f.line ?? 0) : checkKey(f.rule, f.snippet ?? '')

const isLabel = (x: unknown): x is Label => LABELS.includes(x as Label)

function readLabels(data: string, p: SweepProduct): { id: string; label: Label }[] {
  const raw: unknown = JSON.parse(readFileSync(labelFile(data, p), 'utf8'))
  if (!Array.isArray(raw)) throw new Error(`${labelFile(data, p)}: expected an array`)
  return raw.map((x: { id?: unknown; label?: unknown }) => {
    if (typeof x.id !== 'string' || !isLabel(x.label)) throw new Error(`${labelFile(data, p)}: bad label entry`)
    return { id: x.id, label: x.label }
  })
}

/** Match a run against the hand labels. Warning and error hits go into byRule, note hits only count as notes. */
export function scoreRun(data: string, product: SweepProduct, findings: RunFinding[]): ProductScore {
  const keys = sampleKeys(data, product)
  const present = new Map<string, RunFinding>()
  for (const f of findings) if (!present.has(runKey(product, f))) present.set(runKey(product, f), f)
  const labelled = new Set(keys.values())

  let byRule: Record<string, Tally> = {}
  let notes = 0
  let noteTally = EMPTY
  const lost: string[] = []
  for (const { id, label } of readLabels(data, product)) {
    const key = keys.get(id)
    const hit = key === undefined ? undefined : present.get(key)
    if (!hit) {
      lost.push(id)
      continue
    }
    if (hit.severity === 'note') {
      notes += 1
      noteTally = { ...noteTally, [label]: noteTally[label] + 1 }
      continue
    }
    const tally = byRule[hit.rule] ?? EMPTY
    byRule = { ...byRule, [hit.rule]: { ...tally, [label]: tally[label] + 1 } }
  }
  const unlabelled = findings.filter((f) => !labelled.has(runKey(product, f))).length
  return { byRule, notes, noteTally, lost, findings: findings.length, unlabelled }
}

/** Lint the pinned clone at <data>/repos/<name> with today's lint package. */
export async function runLint(data: string, name: string): Promise<RunFinding[]> {
  const result = await lint(['.'], { cwd: join(data, 'repos', name) })
  return result.findings.map((f) => ({ rule: f.rule, severity: f.severity, file: f.file, line: f.line }))
}

type AuditResult = { findings: { rule: string; severity: string; node?: { snippet?: string } | null }[] }
type Launch = () => Promise<{ newContext: (o?: unknown) => Promise<{ routeFromHAR: (h: string, o: { notFound: 'abort' }) => Promise<void> }> }>
type Audit = (o: unknown, launch: Launch) => Promise<AuditResult>

const CLI_DIR = new URL('../../cli/', import.meta.url)

async function loadAudit(): Promise<Audit> {
  const dist = new URL('dist/', CLI_DIR)
  const file = existsSync(dist) ? readdirSync(dist).find((f) => /^audit-.*\.js$/.test(f)) : undefined
  if (!file) throw new Error('packages/cli/dist has no audit-*.js. Run: npm run build -w @dualkit/cli')
  return ((await import(pathToFileURL(join(dist.pathname, file)).href)) as { audit: Audit }).audit
}

function pageUrl(data: string, name: string): string {
  const line = readFileSync(join(data, 'sites.txt'), 'utf8').split('\n').find((l) => l.split(/\s+/)[0] === name)
  const url = line?.split(/\s+/)[1]
  if (!url) throw new Error(`${name} is not in sites.txt`)
  return url
}

/** Replay <data>/har/<name>.har.zip through the built CLI's audit. Requests missing from the recording abort. */
export async function runCheck(data: string, name: string): Promise<RunFinding[]> {
  const audit = await loadAudit()
  const har = join(data, 'har', `${name}.har.zip`)
  if (!existsSync(har)) throw new Error(`no recording at ${har}`)
  const { chromium } = createRequire(new URL('package.json', CLI_DIR))('playwright') as { chromium: { launch: () => Promise<any> } }
  const launch: Launch = async () => {
    const browser = await chromium.launch()
    const newContext = browser.newContext.bind(browser)
    browser.newContext = async (options: unknown) => {
      const context = await newContext(options)
      await context.routeFromHAR(har, { notFound: 'abort' })
      return context
    }
    return browser
  }
  const result = await audit({ url: pageUrl(data, name), ...VIEWPORT, config: { ignore: [], exclude: [] } }, launch)
  return result.findings.map((f) => ({ rule: f.rule, severity: f.severity, snippet: f.node?.snippet ?? null }))
}
