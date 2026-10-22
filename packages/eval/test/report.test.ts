import { describe, expect, it } from 'vitest'
import { renderReport, type EvalResult } from '../src/report.js'

const fixture = (): EvalResult => ({
  at: '2026-10-22',
  precision: [
    { tool: 'check', byRule: { 'a11y/demo': { real: 8, handled: 1, intended: 1, unclear: 2 } }, noteTally: { real: 0, handled: 2, intended: 0, unclear: 0 }, notes: 2, coverage: { labels: 20, matched: 16, lost: { real: 3, handled: 1, intended: 0, unclear: 0 }, unlabelled: 5 }, products: 3, skipped: 1 },
    { tool: 'lint', byRule: {}, noteTally: { real: 0, handled: 0, intended: 0, unclear: 0 }, notes: 0, coverage: { labels: 0, matched: 0, lost: { real: 0, handled: 0, intended: 0, unclear: 0 }, unlabelled: 0 }, products: 0, skipped: 0 },
  ],
  misses: {
    cases: 4,
    dropped: 2,
    results: [
      { id: 'secretco:1', kind: 'date-order', tool: 'check', caught: true },
      { id: 'secretco:1', kind: 'date-order', tool: 'lint', caught: false },
      { id: 'x:2', kind: 'back-arrow', tool: 'check', caught: false },
      { id: 'x:2', kind: 'back-arrow', tool: 'lint', caught: false },
    ],
  },
})

describe('renderReport', () => {
  it('renders per tool, per rule and per kind tables', () => {
    const md = renderReport(fixture())
    expect(md).toContain('Products used: 3 (skipped 1). Cases run: 4. Cases dropped: 2.')
    expect(md).toContain('| check | 80% | 67% | 50% | 62% | 12 |')
    expect(md).toContain('| check | a11y/demo | 80% | 8 | 1 | 1 | 2 |')
    expect(md).toContain('| date-order | 100% (1/1) | 0% (0/1) |')
    expect(md).toContain('| back-arrow | 0% (0/1) | 0% (0/1) |')
  })

  it('shows no data rather than 0% when a row has nothing to count', () => {
    const md = renderReport(fixture())
    expect(md).toContain('| lint | no data | no data | 0% | no data | no data |')
    const empty = renderReport({ at: 'x', precision: [], misses: { cases: 0, dropped: 0, results: [] } })
    expect(empty).not.toContain('0%')
    expect(empty).toContain('no data')
  })

  it('puts no product names or snippets in the markdown', () => {
    const r = fixture()
    const leaky: EvalResult = {
      ...r,
      misses: {
        ...r.misses,
        results: r.misses.results.map((x) => ({ ...x, id: `secretco:<p class="x">:${x.id}` })),
      },
    }
    const md = renderReport(leaky)
    expect(md).not.toContain('secretco')
    expect(md).not.toContain('<p class="x">')
  })

  it('reports notes on their own line, unclear counts and the real-world miss row', () => {
    const r = fixture()
    const md = renderReport({
      ...r,
      misses: { ...r.misses, results: [...r.misses.results, { id: 'r', kind: 'real', tool: 'check', caught: false }] },
    })
    expect(md).toContain('| check | 2 | 0% |')
    expect(md).toContain('| lint | 0 | no data |')
    expect(md).toContain('| check | 20 | 16 (80%) | 3 | 1 | 0 | 0 | 5 |')
    expect(md).toContain('| lint | no data | no data |')
    expect(md).toContain('| real-world miss | 0% (0/1) | no data |')
    expect(md).toMatch(/\| check \| 80% \| 67% \| \d+% \| \d+% \| 12 \| 2 \|/)
  })
})

describe('review and dualkit columns', () => {
  const at = (id: string, tool: 'check' | 'lint' | 'review' | 'dualkit', caught: boolean) => ({ id, kind: 'date-order', tool, caught })
  const withReview = (): EvalResult => ({
    ...fixture(),
    misses: {
      cases: 2, dropped: 0,
      results: [
        at('a', 'check', false), at('a', 'lint', false), at('a', 'review', true), at('a', 'dualkit', true),
        at('b', 'check', false), at('b', 'lint', false), at('b', 'review', false), at('b', 'dualkit', false),
      ],
    },
    review: { skipped: null, spentUsd: 0 },
  })

  it('renders review and dualkit per bug kind and per tool', () => {
    const md = renderReport(withReview())
    expect(md).toContain('| kind | check | lint | review | dualkit |')
    expect(md).toContain('| date-order | 0% (0/2) | 0% (0/2) | 50% (1/2) | 50% (1/2) |')
    expect(md).toContain('| review | no data | no data | 50% | no data | no data | no data |')
    expect(md).toContain('| dualkit | no data | no data | 50% | no data | no data | no data |')
  })

  it('counts a case that only review caught for dualkit', () => {
    const md = renderReport(withReview())
    expect(md).toMatch(/\| check \| [^\n]* \| 0% \|/)
    expect(md).toContain('| dualkit | no data | no data | 50% |')
  })

  it('says review was skipped, with the reason, and shows no review recall', () => {
    const md = renderReport({ ...withReview(), review: { skipped: 'No GEMINI_API_KEY', spentUsd: 0 }, misses: { cases: 1, dropped: 0, results: [at('a', 'check', true), at('a', 'lint', false), at('a', 'dualkit', true)] } })
    expect(md).toContain('Review was skipped: No GEMINI_API_KEY.')
    expect(md).toContain('| date-order | 100% (1/1) | 0% (0/1) |')
    expect(md).not.toContain('dualkit')
  })

  it('keeps the old shape when review did not run: no review or dualkit text', () => {
    const md = renderReport({ ...fixture(), misses: { cases: 1, dropped: 0, results: [at('a', 'check', true), at('a', 'lint', false), at('a', 'dualkit', true)] } })
    expect(md).not.toMatch(/review|dualkit/i)
  })

  it('reports review precision as unlabelled with a count, never 0%', () => {
    const r = withReview()
    const md = renderReport({
      ...r,
      precision: [...r.precision, { tool: 'review', byRule: {}, noteTally: { real: 0, handled: 0, intended: 0, unclear: 0 }, notes: 0, coverage: { labels: 0, matched: 0, lost: { real: 0, handled: 0, intended: 0, unclear: 0 }, unlabelled: 7 }, products: 4, skipped: 0 }],
    })
    expect(md).toContain('| review | unlabelled (7 findings) |')
    expect(md).not.toContain('| review | 0% |')
  })
})
