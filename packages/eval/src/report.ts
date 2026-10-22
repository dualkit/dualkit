import { f1, precision, recall } from './metrics.js'
import type { CaseResult, Tally } from './types.js'

export type PrecisionResult = {
  tool: 'check' | 'lint'
  byRule: Record<string, Tally>
  /** Labels given to note-severity findings. Not part of the warning and error figures. */
  noteTally: Tally
  notes: number
  products: number
  skipped: number
}

export type EvalResult = {
  at: string
  precision: PrecisionResult[]
  misses: { cases: number; dropped: number; results: CaseResult[] }
}

const TOOLS: readonly ('check' | 'lint')[] = ['check', 'lint']
const NO_DATA = 'no data'
const EMPTY: Tally = { real: 0, handled: 0, intended: 0, unclear: 0 }

const add = (a: Tally, b: Tally): Tally => ({
  real: a.real + b.real,
  handled: a.handled + b.handled,
  intended: a.intended + b.intended,
  unclear: a.unclear + b.unclear,
})
const total = (t: Tally): number => t.real + t.handled + t.intended + t.unclear
const pct = (x: number | null): string => (x === null ? NO_DATA : `${Math.round(x * 100)}%`)
const row = (cells: readonly (string | number)[]): string => `| ${cells.join(' | ')} |`
const table = (head: readonly string[], rows: readonly (readonly (string | number)[])[]): string =>
  [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n')

const sumRules = (p: PrecisionResult | undefined): Tally =>
  Object.values(p?.byRule ?? {}).reduce(add, EMPTY)

function recallOf(results: readonly CaseResult[], tool: string, kind?: string): { caught: number; n: number } {
  const rows = results.filter((r) => r.tool === tool && (kind === undefined || r.kind === kind))
  return { caught: rows.filter((r) => r.caught).length, n: rows.length }
}

function toolRows(r: EvalResult): (string | number)[][] {
  return TOOLS.map((tool) => {
    const p = r.precision.find((x) => x.tool === tool)
    const loud = sumRules(p)
    const hasData = p !== undefined && total(loud) > 0
    const all = p ? add(loud, p.noteTally) : EMPTY
    const rec = recallOf(r.misses.results, tool)
    const pLoud = hasData ? precision(loud) : null
    const rLoud = recall(rec.caught, rec.n)
    return [
      tool,
      pct(pLoud),
      pct(p ? precision(all) : null),
      pct(rLoud),
      pct(f1(pLoud, rLoud)),
      hasData ? total(loud) : NO_DATA,
    ]
  })
}

function ruleRows(r: EvalResult): (string | number)[][] {
  return r.precision.flatMap((p) =>
    Object.entries(p.byRule)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule, t]) => [p.tool, rule, pct(precision(t)), t.real, t.handled, t.intended, t.unclear]),
  )
}

function kindRows(r: EvalResult): (string | number)[][] {
  const kinds = [...new Set(r.misses.results.map((x) => x.kind))].sort()
  return kinds.map((kind) => {
    const cell = (tool: string): string => {
      const { caught, n } = recallOf(r.misses.results, tool, kind)
      return n === 0 ? NO_DATA : `${pct(recall(caught, n))} (${caught}/${n})`
    }
    return [kind, cell('check'), cell('lint')]
  })
}

/** Markdown with aggregates only: no product names, no snippets. */
export function renderReport(r: EvalResult): string {
  const products = r.precision.reduce((n, p) => n + p.products, 0)
  const skipped = r.precision.reduce((n, p) => n + p.skipped, 0)
  const header = `Eval ${r.at}. Products used: ${products} (skipped ${skipped}). Cases run: ${r.misses.cases}. Cases dropped: ${r.misses.dropped}.`
  const rules = ruleRows(r)
  return [
    header,
    '## Per tool',
    table(['tool', 'precision (warning and error)', 'precision (all severities)', 'recall', 'F1', 'findings'], toolRows(r)),
    '## Precision per rule',
    rules.length
      ? table(['tool', 'rule', 'precision', 'real', 'handled', 'intended', 'unclear'], rules)
      : NO_DATA,
    '## Recall per bug kind',
    r.misses.results.length ? table(['kind', 'check', 'lint'], kindRows(r)) : NO_DATA,
    '',
  ].join('\n\n')
}
