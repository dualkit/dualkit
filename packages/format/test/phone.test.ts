import { describe, expect, it } from 'vitest'
import { formatUaePhone, isValidUaePhone, parseUaePhone } from '../src/index'

describe('parseUaePhone', () => {
  it.each([
    '050 123 4567',
    '0501234567',
    '+971 50 123 4567',
    '+971501234567',
    '00971501234567',
    '971501234567',
    '501234567',
    '(050) 123-4567',
    '٠٥٠١٢٣٤٥٦٧',
    '+971 (0) 50 123 4567',
    '+971 050 123 4567',
    '009710501234567',
  ])('reads %s as the same mobile number', (input) => {
    const result = parseUaePhone(input)
    expect(result).toEqual({ ok: true, value: { e164: '+971501234567', type: 'mobile' } })
  })

  it('reads every mobile prefix in use', () => {
    for (const prefix of ['50', '52', '54', '55', '56', '58']) {
      expect(parseUaePhone(`0${prefix}1234567`).ok).toBe(true)
    }
  })

  it('reads a Dubai landline', () => {
    expect(parseUaePhone('04 123 4567')).toEqual({ ok: true, value: { e164: '+97141234567', type: 'landline' } })
  })

  it('reads every landline area code', () => {
    for (const area of ['2', '3', '4', '6', '7', '9']) {
      expect(parseUaePhone(`0${area}1234567`).ok).toBe(true)
    }
  })

  it('rejects an unknown mobile prefix', () => {
    const result = parseUaePhone('0511234567')
    expect(result).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
  })

  it('rejects the wrong length', () => {
    expect(parseUaePhone('05012345')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })

  it('rejects another country code', () => {
    expect(parseUaePhone('+966501234567')).toMatchObject({ ok: false, error: { code: 'not_uae' } })
  })

  it('rejects letters', () => {
    expect(parseUaePhone('050 CALL NOW')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })

  it('rejects an empty value', () => {
    expect(parseUaePhone('  ')).toMatchObject({ ok: false, error: { code: 'empty' } })
  })

  it('gives a readable message with every error', () => {
    const result = parseUaePhone('0511234567')
    expect(result.ok === false && result.error.message.length > 0).toBe(true)
  })
})

describe('formatUaePhone', () => {
  it('writes the national style by default', () => {
    expect(formatUaePhone('+971501234567')).toBe('050 123 4567')
    expect(formatUaePhone('041234567')).toBe('04 123 4567')
  })

  it('writes the international style', () => {
    expect(formatUaePhone('0501234567', { style: 'international' })).toBe('+971 50 123 4567')
    expect(formatUaePhone('041234567', { style: 'international' })).toBe('+971 4 123 4567')
  })

  it('writes E.164', () => {
    expect(formatUaePhone('050 123 4567', { style: 'e164' })).toBe('+971501234567')
  })

  it('returns null for a number it cannot read', () => {
    expect(formatUaePhone('12')).toBeNull()
  })
})

describe('isValidUaePhone', () => {
  it('answers yes or no', () => {
    expect(isValidUaePhone('050 123 4567')).toBe(true)
    expect(isValidUaePhone('0511234567')).toBe(false)
  })
})
