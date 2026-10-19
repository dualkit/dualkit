import { describe, expect, it } from 'vitest'
import { gulfWeek, isGulfWeekend, type GulfRegion } from '../src/index'

describe('gulfWeek', () => {
  it('covers every region', () => {
    expect(gulfWeek('AE')).toEqual({ weekend: [6, 7], firstWorkday: 1 })
    expect(gulfWeek('AE-SH')).toEqual({ weekend: [5, 6, 7], firstWorkday: 1 })
    for (const r of ['SA', 'QA', 'KW', 'BH', 'OM'] as const) {
      expect(gulfWeek(r)).toEqual({ weekend: [5, 6], firstWorkday: 7 })
    }
  })
})

describe('gulfWeek is safe to share', () => {
  it('hands out frozen values, so one caller cannot change another region', () => {
    expect(Object.isFrozen(gulfWeek('SA'))).toBe(true)
    expect(Object.isFrozen(gulfWeek('SA').weekend)).toBe(true)
    expect(() => (gulfWeek('SA').weekend as number[]).push(7)).toThrow(TypeError)
    expect(gulfWeek('QA').weekend).toEqual([5, 6])
  })
})

describe('isGulfWeekend', () => {
  const UTC = { timeZone: 'UTC' }
  // 2026-10-15 is a Thursday.
  const day = (d: number) => new Date(`2026-10-${String(d).padStart(2, '0')}T12:00:00Z`)
  const days: Record<GulfRegion, number[]> = {
    AE: [17, 18], 'AE-SH': [16, 17, 18], SA: [16, 17], QA: [16, 17], KW: [16, 17], BH: [16, 17], OM: [16, 17],
  }
  it.each(Object.keys(days) as GulfRegion[])('answers every weekday for %s', (region) => {
    for (let d = 12; d <= 18; d++) {
      expect(isGulfWeekend(day(d), region, UTC)).toBe(days[region].includes(d))
    }
  })
  it('uses the time zone calendar day', () => {
    const thursday2330 = new Date('2026-10-15T23:30:00Z')
    expect(isGulfWeekend(thursday2330, 'SA', UTC)).toBe(false)
    expect(isGulfWeekend(thursday2330, 'SA', { timeZone: 'Asia/Dubai' })).toBe(true)
  })
  it('reads Sunday as 7 and Monday as 1', () => {
    expect(isGulfWeekend(day(18), 'AE', UTC)).toBe(true)
    expect(isGulfWeekend(day(12), 'AE', UTC)).toBe(false)
  })
  it('throws a clear RangeError when the time zone is missing or empty', () => {
    // @ts-expect-error timeZone is required
    expect(() => isGulfWeekend(day(15), 'AE', {})).toThrow(RangeError)
    expect(() => isGulfWeekend(day(15), 'AE', { timeZone: '' })).toThrow(/timeZone/)
  })
  it('throws on an invalid time zone', () => {
    expect(() => isGulfWeekend(day(15), 'AE', { timeZone: 'Mars/Base' })).toThrow(RangeError)
  })
})

describe('unknown regions', () => {
  it('throws a RangeError that names the region', () => {
    expect(() => gulfWeek('EG' as GulfRegion)).toThrow(RangeError)
    expect(() => gulfWeek('EG' as GulfRegion)).toThrow(/EG/)
    expect(() => isGulfWeekend(new Date(), 'toString' as GulfRegion, { timeZone: 'Asia/Dubai' })).toThrow(/toString/)
  })
})
