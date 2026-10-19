import { describe, expect, it } from 'vitest'
import { BenchError } from '../src/config'
import { resolveMonth } from '../src/month'

const now = new Date('2026-11-03T23:30:00Z')

describe('resolveMonth', () => {
  it('defaults a fake run to 2099-01', () => {
    expect(resolveMonth({ fake: true, now })).toBe('2099-01')
  })
  it('keeps a fake run to 2099 months', () => {
    expect(resolveMonth({ month: '2099-03', fake: true, now })).toBe('2099-03')
    expect(() => resolveMonth({ month: '2026-11', fake: true, now })).toThrow(BenchError)
    expect(() => resolveMonth({ month: '2026-11', fake: true, now })).toThrow(/2099/)
  })
  it('defaults a real run to the current UTC month', () => {
    expect(resolveMonth({ now })).toBe('2026-11')
    expect(resolveMonth({ month: '2026-10', now })).toBe('2026-10')
  })
  it('rejects an invalid month', () => {
    expect(() => resolveMonth({ month: 'Nov', now })).toThrow(BenchError)
    expect(() => resolveMonth({ month: '2026-13', now })).toThrow(/YYYY-MM/)
  })
})
