import { describe, expect, it } from 'vitest'
import { formatHijri, toHijri } from '../src/index'

const UTC = { timeZone: 'UTC' } as const

describe('toHijri', () => {
  it('reads the Umm al-Qura calendar', () => {
    expect(toHijri(new Date('2025-06-26T12:00:00Z'), UTC)).toEqual({ year: 1447, month: 1, day: 1 })
  })

  it('finds the first day of Ramadan 1447', () => {
    expect(toHijri(new Date('2026-02-18T12:00:00Z'), UTC)).toEqual({ year: 1447, month: 9, day: 1 })
  })

  it('uses the time zone to decide the day', () => {
    const lateEvening = new Date('2026-02-17T21:30:00Z')
    expect(toHijri(lateEvening, UTC).day).not.toBe(1)
    expect(toHijri(lateEvening, { timeZone: 'Asia/Dubai' })).toEqual({ year: 1447, month: 9, day: 1 })
  })

  it('refuses an invalid date', () => {
    expect(() => toHijri(new Date('nope'), UTC)).toThrow(RangeError)
  })
})

describe('formatHijri', () => {
  const ramadan = new Date('2026-02-18T12:00:00Z')

  it('writes the English month name and AH', () => {
    expect(formatHijri(ramadan, UTC)).toBe('1 Ramadan 1447 AH')
  })

  it('writes the Arabic month name and هـ', () => {
    expect(formatHijri(ramadan, { ...UTC, locale: 'ar' })).toBe('1 رمضان 1447 هـ')
  })

  it('uses Arabic-Indic digits when asked', () => {
    expect(formatHijri(ramadan, { ...UTC, locale: 'ar', numerals: 'arab' })).toBe('١ رمضان ١٤٤٧ هـ')
  })

  it('names all twelve months', () => {
    const names = new Set<string>()
    const start = new Date('2025-06-26T12:00:00Z').getTime()
    for (let d = 0; d < 360; d += 15) {
      names.add(formatHijri(new Date(start + d * 86_400_000), UTC).split(' ').slice(1, -2).join(' '))
    }
    expect(names.size).toBe(12)
  })
})
