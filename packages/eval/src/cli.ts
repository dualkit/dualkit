import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { basePages, buildCases, closeBrowser, freezeCases, FROZEN_FILE, loadFrozenCases, runCase } from './misses.js'
import { ledgerPath, makeReviewer, OUT, spendLine, type Reviewer } from './review-run.js'
import { auditRecorded, checkFindings, listProducts, reviewFindings, runLint, scoreRun, type ProductScore, type RunFinding, type SweepProduct } from './precision.js'
import { renderReport, type Coverage, type EvalResult, type PrecisionResult } from './report.js'
import type { CaseResult, Tally } from './types.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
export { ledgerPath, spendLine }
const RUNS = join(ROOT, 'bench', 'runs', '2026-10')
const PER_KIND = 8
const COMMANDS = ['precision', 'misses', 'all'] as const
type Command = (typeof COMMANDS)[number]
const EMPTY: Tally = { real: 0, handled: 0, intended: 0, unclear: 0 }

export type Parsed = { command: Command; data?: string | undefined; rebuildCases: boolean; review: boolean }

export function parseArgs(argv: readonly string[]): Parsed {
  const [command, ...rest] = argv
  if (!COMMANDS.includes(command as Command)) throw new Error(`Usage: eval <${COMMANDS.join('|')}> [--data <dir>] [--rebuild-cases] [--review]`)
  const i = rest.indexOf('--data')
  if (i >= 0 && !rest[i + 1]) throw new Error('--data needs a folder')
  return { command: command as Command, data: i >= 0 ? rest[i + 1] : undefined, rebuildCases: rest.includes('--rebuild-cases'), review: rest.includes('--review') }
}

/** --data first, then DUALKIT_SWEEP_DATA. */
export function resolveData(flag: string | undefined, env: NodeJS.ProcessEnv): string {
  const dir = flag ?? env.DUALKIT_SWEEP_DATA
  if (!dir) throw new Error('The precision set needs the private sweep data. Pass --data <dir> or set DUALKIT_SWEEP_DATA.')
  return resolve(dir)
}

function addCoverage(c: Coverage, s: ProductScore): Coverage {
  const l = c.lost
  return {
    labels: c.labels + s.labels,
    matched: c.matched + s.labels - s.lost.length,
    lost: { real: l.real + s.lostByLabel.real, handled: l.handled + s.lostByLabel.handled, intended: l.intended + s.lostByLabel.intended, unclear: l.unclear + s.lostByLabel.unclear },
    unlabelled: c.unlabelled + s.unlabelled,
  }
}

const addTally = (a: Tally, b: Tally): Tally => ({ real: a.real + b.real, handled: a.handled + b.handled, intended: a.intended + b.intended, unclear: a.unclear + b.unclear })

/** The result with one product's score added. */
function withScore(cur: PrecisionResult, s: ProductScore): PrecisionResult {
  const byRule = { ...cur.byRule }
  for (const [rule, t] of Object.entries(s.byRule)) byRule[rule] = addTally(byRule[rule] ?? EMPTY, t)
  return { ...cur, byRule, coverage: addCoverage(cur.coverage, s), notes: cur.notes + s.notes, products: cur.products + 1, noteTally: addTally(cur.noteTally, s.noteTally) }
}

const emptyResult = (tool: PrecisionResult['tool'], skipped: number): PrecisionResult => ({
  tool, byRule: {}, noteTally: EMPTY, notes: 0, products: 0, coverage: { labels: 0, matched: 0, lost: EMPTY, unlabelled: 0 }, skipped,
})

type PrecisionRun = { results: PrecisionResult[]; reviewSkipped: string | null; spentUsd: number }

async function precisionSet(data: string, reviewer: Reviewer | null): Promise<PrecisionRun> {
  const { products, skipped } = listProducts(data)
  const tools = ['check', 'lint'] as const
  let out: PrecisionResult[] = tools.map((tool) => emptyResult(tool, skipped.filter((s) => s.tool === tool).length))
  let review = reviewer ? emptyResult('review', 0) : null
  const labelledReview = new Set(products.filter((p) => p.tool === 'review').map((p) => p.name))
  let reviewSkipped: string | null = null
  let spentUsd = 0
  for (const p of products.filter((x): x is SweepProduct & { tool: 'check' | 'lint' } => x.tool !== 'review')) {
    const slot = out.findIndex((x) => x.tool === p.tool)
    let findings: RunFinding[]
    let audited: Awaited<ReturnType<typeof auditRecorded>> | null = null
    try {
      if (p.tool === 'lint') findings = await runLint(data, p.name)
      else { audited = await auditRecorded(data, p.name); findings = checkFindings(audited) }
    } catch (e) {
      console.error(`skipped ${p.tool} product: ${e instanceof Error ? e.message : String(e)}`)
      out = out.map((x, i) => (i === slot ? { ...x, skipped: x.skipped + 1 } : x))
      continue
    }
    out = out.map((x, i) => (i === slot ? withScore(x, scoreRun(data, p, findings)) : x))
    if (reviewer && review && audited) {
      const reviewed = await reviewer.run(audited, `${audited.url}\0${audited.screenshot}`)
      spentUsd += reviewed.spentUsd
      if (reviewed.skipped !== null) { reviewSkipped ??= reviewed.skipped; continue }
      const found = reviewFindings(reviewed)
      const labelled: SweepProduct = { tool: 'review', name: p.name }
      if (labelledReview.has(p.name)) review = withScore(review, scoreRun(data, labelled, found))
      else review = { ...review, products: review.products + 1, coverage: { ...review.coverage, unlabelled: review.coverage.unlabelled + found.length } }
    }
  }
  return { results: review ? [...out, review] : out, reviewSkipped, spentUsd }
}

async function missSet(rebuild: boolean, reviewer: Reviewer | null): Promise<{ misses: EvalResult['misses']; reviewSkipped: string | null; spentUsd: number }> {
  const built = rebuild ? await buildCases(basePages(RUNS), PER_KIND) : await buildCases([], PER_KIND, { frozen: loadFrozenCases() })
  const { cases, dropped } = built
  if (rebuild) writeFileSync(FROZEN_FILE, `${JSON.stringify(freezeCases(cases), null, 1)}\n`)
  const results: CaseResult[] = []
  let reviewSkipped: string | null = null
  let spentUsd = 0
  const review = reviewer
    ? async (html: string) => {
        const r = await reviewer.runHtml(html)
        spentUsd += r.spentUsd
        if (r.skipped !== null) reviewSkipped ??= r.skipped
        return r
      }
    : undefined
  try {
    for (const c of cases) results.push(...(await runCase(c, readFileSync(resolve(ROOT, c.base), 'utf8'), review ? { review } : {})))
  } finally {
    await closeBrowser()
  }
  return { misses: { cases: cases.length, dropped: dropped.length, results }, reviewSkipped, spentUsd }
}

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv, log: (line: string) => void = (l) => console.error(l)): Promise<string> {
  const { command, data, rebuildCases, review } = parseArgs(argv)
  const dir = command === 'misses' ? undefined : resolveData(data, env)
  const at = new Date().toISOString().slice(0, 10)
  const reviewer = review ? makeReviewer({ env, log }) : null
  const precision = dir ? await precisionSet(dir, reviewer) : { results: [], reviewSkipped: null, spentUsd: 0 }
  const missRun = command === 'precision' ? { misses: { cases: 0, dropped: 0, results: [] }, reviewSkipped: null, spentUsd: 0 } : await missSet(rebuildCases, reviewer)
  const reviewState = reviewer ? { skipped: precision.reviewSkipped ?? missRun.reviewSkipped, spentUsd: precision.spentUsd + missRun.spentUsd } : undefined
  const result: EvalResult = { at, precision: precision.results, misses: missRun.misses, ...(reviewState ? { review: reviewState } : {}) }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, `${at}.json`), JSON.stringify(result, null, 1))
  const lines = [renderReport(result)]
  // The last line of the run log, so a reader sees what the month has cost so far.
  if (reviewer) lines.push(spendLine(reviewer.ledger))
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).then(
    (md) => console.log(md),
    (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) },
  )
}
