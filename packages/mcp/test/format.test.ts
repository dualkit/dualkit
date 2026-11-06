import { formatHijri, formatMoney, toHijri } from '@dualkit/format'
import { describe, expect, it } from 'vitest'
import { expectPlainError, json, useClient } from './helpers'

const { call } = useClient()

describe('format: money', () => {
  it('formats a three-decimal currency in Arabic with Arabic digits', async () => {
    const out = json(await call('format', { kind: 'money', amount: 1234.5, currency: 'KWD', locale: 'ar', numerals: 'arab' }))
    expect(out).toEqual({ text: formatMoney(1234.5, { currency: 'KWD', locale: 'ar', numerals: 'arab' }) })
  })

  it('passes fractionDigits through', async () => {
    expect(json(await call('format', { kind: 'money', amount: 10, currency: 'AED', fractionDigits: 0 }))).toEqual({ text: formatMoney(10, { currency: 'AED', fractionDigits: 0 }) })
  })

  it('needs an amount and a currency', async () => {
    expect(expectPlainError(await call('format', { kind: 'money', currency: 'AED' }))).toMatch(/amount/)
    expect(expectPlainError(await call('format', { kind: 'money', amount: 5 }))).toMatch(/currency/)
  })

  it('rejects a currency outside the Gulf', async () => {
    expect(expectPlainError(await call('format', { kind: 'money', amount: 5, currency: 'USD' }))).toMatch(/currency/)
  })
})

describe('format: hijri', () => {
  it('returns the Umm al-Qura date and its text', async () => {
    const date = '2026-02-18T12:00:00Z'
    const out = json(await call('format', { kind: 'hijri', date, timeZone: 'Asia/Riyadh', locale: 'ar' }))
    expect(out).toEqual({
      text: formatHijri(new Date(date), { timeZone: 'Asia/Riyadh', locale: 'ar' }),
      hijri: toHijri(new Date(date), { timeZone: 'Asia/Riyadh' }),
    })
  })

  it('needs a time zone, as format does', async () => {
    expect(expectPlainError(await call('format', { kind: 'hijri', date: '2026-02-18' }))).toMatch(/time zone/i)
  })

  it('rejects a date it cannot read', async () => {
    expect(expectPlainError(await call('format', { kind: 'hijri', date: 'tomorrow', timeZone: 'UTC' }))).toMatch(/date/)
  })

  it('rejects an unknown time zone', async () => {
    expect(expectPlainError(await call('format', { kind: 'hijri', date: '2026-02-18', timeZone: 'Mars/Olympus' }))).toMatch(/time zone/i)
  })
})

describe('format: numerals', () => {
  it('converts to Arabic-Indic digits', async () => {
    expect(json(await call('format', { kind: 'numerals', text: 'Room 12', to: 'arab' }))).toEqual({ text: 'Room ١٢' })
  })

  it('converts to Western digits', async () => {
    expect(json(await call('format', { kind: 'numerals', text: '٠٥٠١٢٣٤٥٦٧', to: 'latn' }))).toEqual({ text: '0501234567' })
  })

  it('needs text and a target', async () => {
    expect(expectPlainError(await call('format', { kind: 'numerals', to: 'arab' }))).toMatch(/text/)
    expect(expectPlainError(await call('format', { kind: 'numerals', text: '12' }))).toMatch(/to/)
  })
})

describe('format: phone', () => {
  it('formats a number for a given country and style', async () => {
    expect(json(await call('format', { kind: 'phone', text: '33123456', country: 'QA', style: 'international' }))).toEqual({ text: '+974 3312 3456', country: 'QA' })
  })

  it('finds the country of an international number', async () => {
    expect(json(await call('format', { kind: 'phone', text: '+971 50 123 4567' }))).toEqual({ text: '050 123 4567', country: 'AE' })
  })

  it('formats every Gulf country', async () => {
    const numbers = { SA: '+966551234567', KW: '+96550012345', BH: '+97336001234', OM: '+96891234567' } as const
    for (const [country, text] of Object.entries(numbers)) {
      const out = json(await call('format', { kind: 'phone', text, country, style: 'e164' })) as { text: string }
      expect(out.text).toBe(text)
    }
  })

  it('returns format\'s own sentence for a number it cannot read', async () => {
    expect(expectPlainError(await call('format', { kind: 'phone', text: '12', country: 'AE' }))).not.toBe('')
    expect(expectPlainError(await call('format', { kind: 'phone', text: '0501234567' }))).toMatch(/\+|country/i)
  })

  it('needs text', async () => {
    expect(expectPlainError(await call('format', { kind: 'phone' }))).toMatch(/text/)
  })
})

describe('format: input', () => {
  it('rejects an unknown kind', async () => {
    expect(expectPlainError(await call('format', { kind: 'weather' }))).toMatch(/kind/)
  })

  it('rejects a missing kind', async () => {
    expect(expectPlainError(await call('format', {}))).toMatch(/kind/)
  })
})
