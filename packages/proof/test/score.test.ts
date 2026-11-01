import { describe, expect, it } from 'vitest'
import { coverage, scoreboard, summarise, type AppResult } from '../src/score'

const app = (over: Partial<AppResult>): AppResult => ({
  id: 'a', repo: 'o/r', commit: 'c', framework: 'next', outcome: 'converted', detail: '', strings: 90, missed: 10, flags: 1, seconds: 1, ...over,
})

describe('score', () => {
  it('computes coverage and handles zero', () => {
    expect(coverage(90, 10)).toBe(90)
    expect(coverage(0, 0)).toBe(0)
  })
  it('leaves failed apps out of the string totals', () => {
    const s = summarise([app({}), app({ id: 'b', outcome: 'crashed', strings: 0, missed: 500 })])
    expect(s).toEqual({ apps: 2, converted: 1, strings: 90, missed: 10, coverage: 90 })
  })
  it('states what the run does not measure', () => {
    expect(scoreboard([app({})], '2026-11-01')).toContain('does not yet measure')
  })
})
