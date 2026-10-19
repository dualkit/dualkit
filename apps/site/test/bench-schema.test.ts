import { describe, expect, it } from 'vitest'
import { parseBenchMonth } from '../lib/bench-schema'

const month = {
  month: '2026-11', generatedAt: '2026-11-01T06:00:00Z', ruleCount: 20,
  models: [{ id: 'g', label: 'G', provider: 'gemini', by: 'Google', mark: 'google', rank: 1, previousRank: null, isNew: true, alone: { rulesPassed: 50, outOf: 100, score: 10 }, dualkit: null, lift: null,
    screens: [{ id: 'otp', title: 'OTP', alone: { ran: false, runs: 1, reasons: ['Hit the token cap'] }, dualkit: { ran: true, runs: 3, rulesPassed: 18, score: 70, missing: [], findings: [], shot: null, pageHeight: 900, raw: 'bench/runs/x.json' } }] }],
}

describe('parseBenchMonth maker and rank', () => {
  const with_ = (patch: Record<string, unknown>) => ({ ...month, models: [{ ...month.models[0], ...patch }] })
  it('keeps by, mark, rank and previousRank', () => {
    const out = parseBenchMonth(with_({ rank: 2, previousRank: 3 }))
    expect(out.models[0]).toMatchObject({ by: 'Google', mark: 'google', rank: 2, previousRank: 3 })
  })
  it('allows null ranks', () => {
    expect(parseBenchMonth(with_({ rank: null, previousRank: null })).models[0]).toMatchObject({ rank: null, previousRank: null })
  })
  it('names a missing or bad field', () => {
    expect(() => parseBenchMonth(with_({ by: undefined }))).toThrow(/models\.0\.by/)
    expect(() => parseBenchMonth(with_({ mark: 3 }))).toThrow(/models\.0\.mark/)
    expect(() => parseBenchMonth(with_({ rank: 'first' }))).toThrow(/models\.0\.rank/)
    expect(() => parseBenchMonth(with_({ previousRank: undefined }))).toThrow(/models\.0\.previousRank/)
  })
})

describe('parseBenchMonth', () => {
  it('accepts a valid month', () => {
    expect(parseBenchMonth(month)).toEqual(month)
  })
  it('names the bad field', () => {
    expect(() => parseBenchMonth({ ...month, month: 'Nov' })).toThrow(/month/)
    expect(() => parseBenchMonth({ ...month, models: [{ ...month.models[0], provider: 'x' }] })).toThrow(/provider/)
  })
  it('rejects a ran cell with no score', () => {
    const bad = structuredClone(month)
    ;(bad.models[0]!.screens[0]!.dualkit as Record<string, unknown>).rulesPassed = 'many'
    expect(() => parseBenchMonth(bad)).toThrow(/rulesPassed/)
  })
  it('requires ran and isNew to be booleans', () => {
    const noRan = structuredClone(month)
    delete (noRan.models[0]!.screens[0]!.alone as Record<string, unknown>).ran
    expect(() => parseBenchMonth(noRan)).toThrow(/ran/)
    const badNew = structuredClone(month)
    ;(badNew.models[0] as Record<string, unknown>).isNew = 'yes'
    expect(() => parseBenchMonth(badNew)).toThrow(/isNew/)
    const noNew = structuredClone(month)
    delete (noNew.models[0] as Record<string, unknown>).isNew
    expect(() => parseBenchMonth(noNew)).toThrow(/isNew/)
  })
  it('requires a cell that did not run to list its reasons as strings', () => {
    const none = structuredClone(month)
    delete (none.models[0]!.screens[0]!.alone as Record<string, unknown>).reasons
    expect(() => parseBenchMonth(none)).toThrow(/alone\.reasons/)
    const bad = structuredClone(month)
    ;(bad.models[0]!.screens[0]!.alone as Record<string, unknown>).reasons = ['ok', 3]
    expect(() => parseBenchMonth(bad)).toThrow(/alone\.reasons\.1/)
  })
})
