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
    expect(s).toEqual({ apps: 2, converted: 1, strings: 90, missed: 10, coverage: 90, typeErrors: 0, buildable: 0, built: 0 })
  })
  it('states what the run does not measure', () => {
    expect(scoreboard([app({})], '2026-11-01')).toContain('does not yet measure')
  })
})

describe('newErrors', () => {
  it('counts only errors convert added, by file and code', async () => {
    const { newErrors } = await import('../src/run')
    expect(newErrors(['a TS1', 'a TS1'], ['a TS1', 'a TS1', 'a TS1', 'b TS2'])).toBe(2)
    expect(newErrors(['a TS1'], [])).toBe(0)
  })
})

describe('build score', () => {
  it('counts only apps that built before converting', () => {
    const s = summarise([app({ buildBefore: true, buildAfter: true }), app({ buildBefore: true, buildAfter: false }), app({ buildBefore: false, buildAfter: false })])
    expect(s).toMatchObject({ buildable: 2, built: 1 })
  })
})
