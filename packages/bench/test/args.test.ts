import { describe, expect, it } from 'vitest'
import { DEADLINE_MS, parseCli } from '../src/args'
import { BenchError } from '../src/config'

describe('parseCli', () => {
  it('sets a soft deadline 140 minutes out by default', () => {
    expect(DEADLINE_MS).toBe(140 * 60_000)
    expect(parseCli([], 1_000).deadline).toBe(1_000 + 140 * 60_000)
  })
  it('drops the deadline with --no-deadline', () => {
    expect(parseCli(['--no-deadline'], 1_000).deadline).toBeUndefined()
  })
  it('reads the summary switches', () => {
    expect(parseCli([], 0)).toMatchObject({ summaryOnly: false, noSummary: false, fake: false })
    expect(parseCli(['--no-summary'], 0).noSummary).toBe(true)
    expect(parseCli(['--summary-only', '--month', '2026-11'], 0)).toMatchObject({ summaryOnly: true, month: '2026-11' })
    expect(() => parseCli(['--summary-only', '--no-summary'], 0)).toThrow(BenchError)
  })
  it('reads --print-month', () => {
    expect(parseCli([], 0).printMonth).toBe(false)
    expect(parseCli(['--print-month', '--month', '2026-11'], 0)).toMatchObject({ printMonth: true, month: '2026-11' })
  })
  it('limits a live probe to one screen and a number of runs', () => {
    expect(parseCli(['--screen', 'otp', '--runs', '1'], 0)).toMatchObject({ screen: 'otp', runs: 1 })
    expect(parseCli([], 0)).toMatchObject({ screen: undefined, runs: undefined })
  })
  it('rejects an unknown screen, runs outside 1 to 3, and unknown flags, as BenchErrors', () => {
    expect(() => parseCli(['--screen', 'nonexistent'], 0)).toThrow(/otp/)
    for (const n of ['0', '4', '1.5', 'two']) expect(() => parseCli(['--runs', n], 0), n).toThrow(BenchError)
    expect(() => parseCli(['--modle', 'x'], 0)).toThrow(BenchError)
  })
})
