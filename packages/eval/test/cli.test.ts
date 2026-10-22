import { describe, expect, it } from 'vitest'
import { ledgerPath, parseArgs, resolveData, spendLine } from '../src/cli.js'

describe('data folder', () => {
  it('reads --data, then DUALKIT_SWEEP_DATA, and fails with a clear message when neither is set', () => {
    expect(resolveData('/a', { DUALKIT_SWEEP_DATA: '/b' })).toBe('/a')
    expect(resolveData(undefined, { DUALKIT_SWEEP_DATA: '/b' })).toBe('/b')
    expect(() => resolveData(undefined, {})).toThrow(/--data <dir> or set DUALKIT_SWEEP_DATA/)
  })

  it('parses the command and the flag', () => {
    expect(parseArgs(['all', '--data', '/x'])).toEqual({ command: 'all', data: '/x', rebuildCases: false, review: false })
    expect(parseArgs(['misses'])).toEqual({ command: 'misses', data: undefined, rebuildCases: false, review: false })
    expect(parseArgs(['misses', '--rebuild-cases']).rebuildCases).toBe(true)
    expect(() => parseArgs(['nope'])).toThrow(/Usage/)
    expect(() => parseArgs(['all', '--data'])).toThrow(/needs a folder/)
  })
})

describe('review options', () => {
  it('parses --review', () => {
    expect(parseArgs(['misses', '--review']).review).toBe(true)
    expect(parseArgs(['misses']).review).toBe(false)
  })

  it('ends the run log with the spend line', () => {
    const ledger = { spent: () => 0, add: () => {}, capUsd: 3 }
    expect(spendLine(ledger)).toBe('Spent $0.00 of $3.00 this month')
    expect(spendLine({ ...ledger, spent: () => 1.234 })).toBe('Spent $1.23 of $3.00 this month')
  })

  it('puts the ledger in the package out folder, one file per month', () => {
    expect(ledgerPath(new Date('2026-10-22T10:00:00Z'))).toMatch(/packages\/eval\/out\/spend-2026-10\.json$/)
  })
})
