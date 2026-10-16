import { describe, expect, it } from 'vitest'
import { formatSaudiPhone, isValidSaudiPhone, parseSaudiPhone } from '../src/index'

describe('parseSaudiPhone', () => {
  it.each([
    '055 123 4567',
    '0551234567',
    '+966 55 123 4567',
    '+966551234567',
    '00966551234567',
    '966551234567',
    '551234567',
    '(055) 123-4567',
    '٠٥٥١٢٣٤٥٦٧',
    '+966 (0) 55 123 4567',
    '+966 055 123 4567',
  ])('reads %s as the same mobile number', (input) => {
    expect(parseSaudiPhone(input)).toEqual({ ok: true, value: { e164: '+966551234567', type: 'mobile' } })
  })

  it('reads every mobile prefix in use', () => {
    for (const prefix of ['50', '51', '53', '54', '55', '56', '57', '58', '59']) {
      expect(parseSaudiPhone(`0${prefix}1234567`).ok).toBe(true)
    }
  })

  it('reads a Riyadh landline', () => {
    expect(parseSaudiPhone('011 234 5678')).toEqual({ ok: true, value: { e164: '+966112345678', type: 'landline' } })
  })

  it('reads every landline area code', () => {
    for (const area of ['11', '12', '13', '14', '16', '17']) {
      expect(parseSaudiPhone(`0${area}2345678`).ok).toBe(true)
    }
  })

  it('rejects an unassigned mobile prefix', () => {
    expect(parseSaudiPhone('0521234567')).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
  })

  it('rejects a number that is neither mobile nor landline', () => {
    expect(parseSaudiPhone('0212345678')).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
  })

  it('rejects a reserved area code', () => {
    expect(parseSaudiPhone('0152345678')).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
  })

  it('rejects the wrong length', () => {
    expect(parseSaudiPhone('05512345')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
    expect(parseSaudiPhone('01123456')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })

  it('rejects a UAE number', () => {
    expect(parseSaudiPhone('+971501234567')).toMatchObject({ ok: false, error: { code: 'not_saudi' } })
  })

  it('rejects letters', () => {
    expect(parseSaudiPhone('055 CALL NOW')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })

  it('rejects an empty value', () => {
    expect(parseSaudiPhone('  ')).toMatchObject({ ok: false, error: { code: 'empty' } })
  })

  it('gives a readable message with every error', () => {
    const result = parseSaudiPhone('0521234567')
    expect(result.ok === false && result.error.message.length > 0).toBe(true)
  })
})

describe('formatSaudiPhone', () => {
  it('writes the national style by default', () => {
    expect(formatSaudiPhone('+966551234567')).toBe('055 123 4567')
    expect(formatSaudiPhone('0112345678')).toBe('011 234 5678')
  })

  it('writes the international style', () => {
    expect(formatSaudiPhone('0551234567', { style: 'international' })).toBe('+966 55 123 4567')
    expect(formatSaudiPhone('0112345678', { style: 'international' })).toBe('+966 11 234 5678')
  })

  it('writes E.164', () => {
    expect(formatSaudiPhone('055 123 4567', { style: 'e164' })).toBe('+966551234567')
  })

  it('returns null for a number it cannot read', () => {
    expect(formatSaudiPhone('12')).toBeNull()
  })
})

describe('isValidSaudiPhone', () => {
  it('answers yes or no', () => {
    expect(isValidSaudiPhone('055 123 4567')).toBe(true)
    expect(isValidSaudiPhone('0521234567')).toBe(false)
  })
})
