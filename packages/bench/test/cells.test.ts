import { describe, expect, it } from 'vitest'
import { cell, effective, lift, total, type BuildScore } from '../src/cells'

const b = (run: number, rulesPassed: number, score = rulesPassed * 5, missing: string[] = []): BuildScore => ({ run, rulesPassed, score, missing })

describe('effective', () => {
  it('zeroes an incomplete build', () => {
    expect(effective(b(1, 20, 100, ['phone field']))).toEqual({ rulesPassed: 0, score: 0 })
  })
})

describe('cell', () => {
  it('takes the middle of three', () => {
    const c = cell([b(1, 18), b(2, 9), b(3, 14)])
    expect(c).toMatchObject({ ran: true, runs: 3, rulesPassed: 14, median: { run: 3 } })
  })
  it('is a real build when runs differ wildly', () => {
    const c = cell([b(1, 20), b(2, 0), b(3, 18)])
    if (!c.ran) throw new Error('should run')
    expect([20, 0, 18]).toContain(c.rulesPassed)
    expect(c.rulesPassed).toBe(18)
  })
  it('takes the lower of two', () => {
    expect(cell([b(1, 18), b(2, 10)])).toMatchObject({ ran: true, runs: 2, rulesPassed: 10 })
  })
  it('does not run with fewer than two builds', () => {
    expect(cell([b(1, 18)])).toEqual({ ran: false, runs: 1 })
    expect(cell([])).toEqual({ ran: false, runs: 0 })
  })
  it('lets an incomplete build drag the cell down, never up', () => {
    const c = cell([b(1, 20, 100, ['IBAN']), b(2, 20, 100, ['IBAN']), b(3, 12)])
    expect(c).toMatchObject({ ran: true, rulesPassed: 0 })
  })
  it('breaks ties by score', () => {
    expect(cell([b(1, 15, 40), b(2, 15, 10), b(3, 15, 70)])).toMatchObject({ score: 40 })
  })
})

describe('total and lift', () => {
  const ran = (n: number, s = n * 5) => cell([b(1, n, s), b(2, n, s), b(3, n, s)])
  it('sums five screens and averages the score', () => {
    expect(total([ran(10), ran(12), ran(14), ran(16), ran(18)], 20)).toEqual({ rulesPassed: 70, outOf: 100, score: 70 })
  })
  it('is null when any screen did not run', () => {
    expect(total([ran(10), ran(12), cell([]), ran(16), ran(18)], 20)).toBeNull()
  })
  it('is the difference, or null when either side is missing', () => {
    expect(lift({ rulesPassed: 50, outOf: 100, score: 10 }, { rulesPassed: 82, outOf: 100, score: 60 })).toBe(32)
    expect(lift(null, { rulesPassed: 82, outOf: 100, score: 60 })).toBeNull()
  })
})
