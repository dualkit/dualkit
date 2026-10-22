import { f1, precision, recall } from './metrics.js'
import type { CaseResult, Tally } from './types.js'

export type Coverage = {
  labels: number
  matched: number
  /** Labels with no matching finding today, by label. */
  lost: Tally
  /** Findings today with no label at all. */
  unlabelled: number
}

export type PrecisionResult = {
  tool: 'check' | 'lint' | 'review'
  byRule: Record<string, Tally>
  /** Labels given to note-severity findings. Not part of the warning and error figures. */
  noteTally: Tally
  notes: number
  /** How many hand labels still match a finding in today's run. */
  coverage: Coverage
  products: number
  skipped: number
}

export type EvalResult = {
  at: string
  precision: PrecisionResult[]
  misses: { cases: number; dropped: number; results: CaseResult[] }
  /** Set when the run used --review. `skipped` holds the reason review did not run. */
  review?: { skipped: string | null; spentUsd: number }
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

const BASE_TOOLS = ['check', 'lint'] as const
const WITH_REVIEW = ['check', 'lint', 'review', 'dualkit'] as const

/** Review columns appear only when review ran for at least one case or page. */
const reviewRan = (r: EvalResult): boolean =>
  r.misses.results.some((x) => x.tool === 'review') || r.precision.some((p) => p.tool === 'review' && p.products > 0)
const recallTools = (r: EvalResult): readonly string[] => (reviewRan(r) ? WITH_REVIEW : BASE_TOOLS)

/** Review precision needs hand labels. Without them, say so and give the number of findings waiting for a label. */
function reviewPrecision(p: PrecisionResult | undefined, labelled: number): string | null {
  if (!p || labelled > 0) return null
  return `unlabelled (${p.coverage.unlabelled} finding${p.coverage.unlabelled === 1 ? '' : 's'})`
}

function toolRows(r: EvalResult): (string | number)[][] {
  const base = checkLintRows(r)
  const extra = (reviewRan(r) ? (['review', 'dualkit'] as const) : []).flatMap((tool) => {
    const p = r.precision.find((x) => x.tool === tool)
    const rec = recallOf(r.misses.results, tool)
    if (rec.n === 0 && !p) return []
    const loud = sumRules(p)
    const hasData = p !== undefined && total(loud) > 0
    const pLoud = hasData ? precision(loud) : null
    const rLoud = recall(rec.caught, rec.n)
    return [[tool, reviewPrecision(p, total(loud)) ?? pct(pLoud), p && hasData ? pct(precision(add(loud, p.noteTally))) : NO_DATA, pct(rLoud), pct(f1(pLoud, rLoud)), hasData ? total(loud) : NO_DATA, p && hasData ? loud.unclear + p.noteTally.unclear : NO_DATA]]
  })
  return [...base, ...extra]
}

function checkLintRows(r: EvalResult): (string | number)[][] {
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
      p ? loud.unclear + p.noteTally.unclear : NO_DATA,
    ]
  })
}

function noteRows(r: EvalResult): (string | number)[][] {
  return TOOLS.map((tool) => {
    const p = r.precision.find((x) => x.tool === tool)
    return [tool, p ? p.notes : NO_DATA, p ? pct(precision(p.noteTally)) : NO_DATA]
  })
}

function coverageRows(r: EvalResult): (string | number)[][] {
  return TOOLS.map((tool) => {
    const c = r.precision.find((x) => x.tool === tool)?.coverage
    if (!c || c.labels === 0) return [tool, NO_DATA, NO_DATA, NO_DATA, NO_DATA, NO_DATA, NO_DATA, NO_DATA]
    const l = c.lost
    return [tool, c.labels, `${c.matched} (${pct(c.matched / c.labels)})`, l.real, l.handled, l.intended, l.unclear, c.unlabelled]
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
    const name = kind === 'real' ? 'real-world miss' : kind
    const cell = (tool: string): string => {
      const { caught, n } = recallOf(r.misses.results, tool, kind)
      return n === 0 ? NO_DATA : `${pct(recall(caught, n))} (${caught}/${n})`
    }
    return [name, ...recallTools(r).map(cell)]
  })
}

const reviewLine = (r: EvalResult): string[] =>
  !r.review ? [] : [r.review.skipped !== null ? `Review was skipped: ${r.review.skipped}.` : `Review ran and spent $${r.review.spentUsd.toFixed(2)} on this run.`]

/** Markdown with aggregates only: no product names, no snippets. */
export function renderReport(r: EvalResult): string {
  const products = r.precision.reduce((n, p) => n + p.products, 0)
  const skipped = r.precision.reduce((n, p) => n + p.skipped, 0)
  const header = `Eval ${r.at}. Products used: ${products} (skipped ${skipped}). Cases run: ${r.misses.cases}. Cases dropped: ${r.misses.dropped}.`
  const rules = ruleRows(r)
  return [
    header,
    ...reviewLine(r),
    '## Per tool',
    table(['tool', 'precision (warning and error)', 'precision (all severities)', 'recall', 'F1', 'findings', 'unclear'], toolRows(r)),
    '## Notes',
    table(['tool', 'notes', 'precision on notes'], noteRows(r)),
    '## Label coverage',
    table(['tool', 'labels', 'still match', 'lost real', 'lost handled', 'lost intended', 'lost unclear', 'unlabelled findings'], coverageRows(r)),
    '## Precision per rule',
    rules.length
      ? table(['tool', 'rule', 'precision', 'real', 'handled', 'intended', 'unclear'], rules)
      : NO_DATA,
    '## Recall per bug kind',
    r.misses.results.length ? table(['kind', ...recallTools(r)], kindRows(r)) : NO_DATA,
    '',
  ].join('\n\n')
}
