import { describe, expect, it } from 'vitest'
import { renderReport, type EvalResult } from '../src/report.js'

const fixture = (): EvalResult => ({
  at: '2026-10-22',
  precision: [
    { tool: 'check', byRule: { 'a11y/demo': { real: 8, handled: 1, intended: 1, unclear: 2 } }, noteTally: { real: 0, handled: 2, intended: 0, unclear: 0 }, notes: 2, products: 3, skipped: 1 },
    { tool: 'lint', byRule: {}, noteTally: { real: 0, handled: 0, intended: 0, unclear: 0 }, notes: 0, products: 0, skipped: 0 },
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
    const withNames = { ...r, precision: [{ ...r.precision[0]!, name: 'secretco', snippet: '<p class="x">' }, r.precision[1]!] } as EvalResult
    const md = renderReport(withNames)
    expect(md).not.toContain('secretco')
    expect(md).not.toContain('<p class="x">')
  })
})
