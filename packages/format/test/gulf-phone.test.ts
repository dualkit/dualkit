import { describe, expect, it } from 'vitest'
import { isValidGulfPhone, parseGulfPhone } from '../src/index'

describe('parseGulfPhone', () => {
  it.each([
    ['+971 50 123 4567', 'AE', '+971501234567', 'mobile'],
    ['+966 55 123 4567', 'SA', '+966551234567', 'mobile'],
    ['+974 3312 3456', 'QA', '+97433123456', 'mobile'],
    ['+965 5001 2345', 'KW', '+96550012345', 'mobile'],
    ['+973 1700 1234', 'BH', '+97317001234', 'landline'],
    ['+973 6600 1234', 'BH', '+97366001234', 'unknown'],
    ['+968 2412 3456', 'OM', '+96824123456', 'landline'],
    ['00968 9212 3456', 'OM', '+96892123456', 'mobile'],
    ['+٩٧٤ ٣٣١٢ ٣٤٥٦', 'QA', '+97433123456', 'mobile'],
  ])('reads %s', (input, country, e164, type) => {
    expect(parseGulfPhone(input)).toEqual({ ok: true, value: { country, e164, type } })
  })

  it('never guesses a country without a code', () => {
    for (const input of ['3312 3456', '5001 2345', '0501234567', '971501234567', '9712 3456']) {
      expect(parseGulfPhone(input)).toMatchObject({ ok: false, error: { code: 'needs_country_code' } })
    }
  })

  it('rejects a code outside the Gulf', () => {
    expect(parseGulfPhone('+44 20 7946 0000')).toMatchObject({ ok: false, error: { code: 'not_gulf' } })
    expect(parseGulfPhone('0044 20 7946 0000')).toMatchObject({ ok: false, error: { code: 'not_gulf' } })
  })

  it('passes the country error through', () => {
    expect(parseGulfPhone('+974 0 3312 3456')).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
    expect(parseGulfPhone('+968 9000 0000')).toMatchObject({ ok: false, error: { code: 'unknown_prefix' } })
    expect(parseGulfPhone('+968 9212 345')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })

  it('rejects empty and bad characters', () => {
    expect(parseGulfPhone(' ')).toMatchObject({ ok: false, error: { code: 'empty' } })
    expect(parseGulfPhone('+974 abc')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })

  it('answers yes or no', () => {
    expect(isValidGulfPhone('+97433123456')).toBe(true)
    expect(isValidGulfPhone('33123456')).toBe(false)
  })
})
