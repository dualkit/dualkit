import { describe, expect, it } from 'vitest'
import { formatSaudiVatNumber, isValidSaudiVatNumber, parseSaudiVatNumber } from '../src/index'

describe('Saudi VAT number', () => {
  it.each(['300000000000003', '310123456700003', '3101 2345 6700 003', '٣١٠١٢٣٤٥٦٧٠٠٠٠٣'])('reads %s', (input) => {
    expect(parseSaudiVatNumber(input).ok).toBe(true)
  })
  it('returns the bare digits', () => {
    expect(parseSaudiVatNumber('3101 2345 6700 003')).toEqual({ ok: true, value: '310123456700003' })
    expect(formatSaudiVatNumber('٣١٠١٢٣٤٥٦٧٠٠٠٠٣')).toBe('310123456700003')
    expect(formatSaudiVatNumber('12')).toBeNull()
  })
  it('rejects each fault with its code', () => {
    const code = (s: string) => {
      const r = parseSaudiVatNumber(s)
      return r.ok ? 'ok' : r.error.code
    }
    expect(code(' ')).toBe('empty')
    expect(code('3000000000A0003')).toBe('invalid_characters')
    expect(code('30000000000003')).toBe('invalid_length')
    expect(code('3000000000000033')).toBe('invalid_length')
    expect(code('100000000000003')).toBe('invalid_prefix')
    expect(code('300000000000001')).toBe('invalid_suffix')
    expect(isValidSaudiVatNumber('300000000000003')).toBe(true)
    expect(isValidSaudiVatNumber('300000000000001')).toBe(false)
  })
})
