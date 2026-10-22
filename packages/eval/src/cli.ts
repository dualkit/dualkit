import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { basePages, buildCases, closeBrowser, runCase } from './misses.js'
import { listProducts, runCheck, runLint, scoreRun, type ProductScore, type RunFinding } from './precision.js'
import { renderReport, type Coverage, type EvalResult, type PrecisionResult } from './report.js'
import type { CaseResult, Tally } from './types.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const OUT = fileURLToPath(new URL('../out/', import.meta.url))
const RUNS = join(ROOT, 'bench', 'runs', '2026-10')
const PER_KIND = 8
const COMMANDS = ['precision', 'misses', 'all'] as const
type Command = (typeof COMMANDS)[number]
const EMPTY: Tally = { real: 0, handled: 0, intended: 0, unclear: 0 }

export type Parsed = { command: Command; data?: string | undefined }

export function parseArgs(argv: readonly string[]): Parsed {
  const [command, ...rest] = argv
  if (!COMMANDS.includes(command as Command)) throw new Error(`Usage: eval <${COMMANDS.join('|')}> [--data <dir>]`)
  const i = rest.indexOf('--data')
  if (i >= 0 && !rest[i + 1]) throw new Error('--data needs a folder')
  return { command: command as Command, data: i >= 0 ? rest[i + 1] : undefined }
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

async function precisionSet(data: string): Promise<PrecisionResult[]> {
  const { products, skipped } = listProducts(data)
  const out: PrecisionResult[] = (['check', 'lint'] as const).map((tool) => ({
    tool, byRule: {}, noteTally: EMPTY, notes: 0, products: 0,
    coverage: { labels: 0, matched: 0, lost: EMPTY, unlabelled: 0 },
    skipped: skipped.filter((s) => s.tool === tool).length,
  }))
  for (const p of products) {
    const slot = out.findIndex((x) => x.tool === p.tool)
    const cur = out[slot]!
    let findings: RunFinding[]
    try {
      findings = p.tool === 'lint' ? await runLint(data, p.name) : await runCheck(data, p.name)
    } catch (e) {
      console.error(`skipped ${p.tool} product: ${e instanceof Error ? e.message : String(e)}`)
      out[slot] = { ...cur, skipped: cur.skipped + 1 }
      continue
    }
    const s = scoreRun(data, p, findings)
    const byRule = { ...cur.byRule }
    for (const [rule, t] of Object.entries(s.byRule)) {
      const was = byRule[rule] ?? EMPTY
      byRule[rule] = { real: was.real + t.real, handled: was.handled + t.handled, intended: was.intended + t.intended, unclear: was.unclear + t.unclear }
    }
    const n = cur.noteTally
    out[slot] = {
      ...cur, byRule, coverage: addCoverage(cur.coverage, s), notes: cur.notes + s.notes, products: cur.products + 1,
      noteTally: { real: n.real + s.noteTally.real, handled: n.handled + s.noteTally.handled, intended: n.intended + s.noteTally.intended, unclear: n.unclear + s.noteTally.unclear },
    }
  }
  return out
}

async function missSet(): Promise<EvalResult['misses']> {
  const { cases, dropped } = await buildCases(basePages(RUNS), PER_KIND)
  const results: CaseResult[] = []
  try {
    for (const c of cases) results.push(...(await runCase(c, readFileSync(resolve(ROOT, c.base), 'utf8'))))
  } finally {
    await closeBrowser()
  }
  return { cases: cases.length, dropped: dropped.length, results }
}

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<string> {
  const { command, data } = parseArgs(argv)
  const dir = command === 'misses' ? undefined : resolveData(data, env)
  const at = new Date().toISOString().slice(0, 10)
  const precision = dir ? await precisionSet(dir) : []
  const misses = command === 'precision' ? { cases: 0, dropped: 0, results: [] } : await missSet()
  const result: EvalResult = { at, precision, misses }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, `${at}.json`), JSON.stringify(result, null, 1))
  return renderReport(result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).then(
    (md) => console.log(md),
    (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) },
  )
}
