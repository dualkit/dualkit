import { describe, expect, it } from 'vitest'
import { gulfClock } from '../lib/clock'
import { readCode } from '../lib/otp'

describe('readCode', () => {
  it('reads Western digits', () => {
    expect(readCode(['4', '7', '2', '9'])).toEqual({ complete: true, value: '4729' })
  })

  it('reads Arabic-Indic and Persian digits the same way', () => {
    expect(readCode(['٤', '٧', '٢', '٩'])).toEqual({ complete: true, value: '4729' })
    expect(readCode(['۴', '۷', '۲', '۹'])).toEqual({ complete: true, value: '4729' })
  })

  it('is incomplete until every cell has a digit', () => {
    expect(readCode(['٤', '', '٢', '٩'])).toEqual({ complete: false, value: '4 29' })
  })

  it('ignores anything that is not a digit', () => {
    expect(readCode(['a', '7', '2', '9'])).toEqual({ complete: false, value: ' 729' })
  })
})

describe('gulfClock', () => {
  const at = new Date('2026-02-18T11:22:05Z')

  it('shows Riyadh time on a 24-hour clock', () => {
    expect(gulfClock(at, 'Asia/Riyadh').time).toBe('14:22')
  })

  it('shows Dubai time an hour ahead', () => {
    expect(gulfClock(at, 'Asia/Dubai').time).toBe('15:22')
  })

  it('gives the Umm al-Qura date for the same zone', () => {
    expect(gulfClock(at, 'Asia/Riyadh').hijri).toBe('1 Ramadan 1447 AH')
  })

  it('places the minute on a 0 to 1 ruler across the day', () => {
    expect(gulfClock(at, 'Asia/Riyadh').dayFraction).toBeCloseTo((14 * 60 + 22) / 1440, 5)
  })
})
