import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { listProducts, scoreRun, type RunFinding } from '../src/precision.js'

const DATA = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sweep')
const FX = { tool: 'lint', name: 'fx' } as const
const PG = { tool: 'check', name: 'pg' } as const

const at = (rule: string, severity: string, file: string, line: number): RunFinding => ({ rule, severity, file, line })
const fxFindings = (): RunFinding[] => [
  at('source/demo-rule', 'warning', 'src/a.css', 3),
  at('source/demo-rule', 'warning', 'src/a.css', 9),
  at('source/demo-rule', 'error', 'src/b.css', 2),
  at('source/demo-rule', 'warning', 'src/b.css', 7),
  at('source/demo-rule', 'warning', 'src/c.css', 1),
  at('source/demo-note', 'note', 'src/c.css', 5),
  at('source/demo-rule', 'warning', 'src/z.css', 40),
]

describe('precision set', () => {
  it('scores kept labels by rule and leaves out notes', () => {
    const score = scoreRun(DATA, FX, fxFindings())
    expect(score.byRule).toEqual({ 'source/demo-rule': { real: 3, handled: 1, intended: 0, unclear: 1 } })
    expect(score.notes).toBe(1)
    expect(score.noteTally).toEqual({ real: 1, handled: 0, intended: 0, unclear: 0 })
    expect(score.lost).toEqual([])
    expect(score.findings).toBe(7)
    expect(score.unlabelled).toBe(1)
  })

  it('counts a labelled finding that no longer appears as lost, by id', () => {
    const score = scoreRun(DATA, FX, fxFindings().filter((f) => f.line !== 9))
    expect(score.lost).toEqual(['fx#2'])
    expect(score.byRule['source/demo-rule']).toEqual({ real: 2, handled: 1, intended: 0, unclear: 1 })
  })

  it('matches check findings by rule and the first 100 characters of the snippet', () => {
    const long = '<p class="demo">made up paragraph</p>'
    const score = scoreRun(DATA, PG, [
      { rule: 'demo/check-rule', severity: 'warning', snippet: long },
      { rule: 'demo/check-rule', severity: 'warning', snippet: null },
    ])
    expect(score.byRule['demo/check-rule']).toEqual({ real: 1, handled: 0, intended: 0, unclear: 0 })
    expect(score.lost).toEqual(['pg#2'])
    expect(score.unlabelled).toBe(1)
  })

  it('skips a product with a label file but no sample file, and says why', () => {
    const { products, skipped } = listProducts(DATA)
    expect(products).toHaveLength(2)
    expect(products).toEqual(expect.arrayContaining([FX, PG]))
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toMatchObject({ tool: expect.stringMatching(/^(check|lint)$/), name: 'orphan', why: expect.stringMatching(/sample/) })
  })
})
