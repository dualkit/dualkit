import { describe, expect, it } from 'vitest'
import {
  formatBahrainPhone, formatKuwaitPhone, formatOmanPhone, formatQatarPhone,
  isValidBahrainPhone, isValidKuwaitPhone, isValidOmanPhone, isValidQatarPhone,
  parseBahrainPhone, parseKuwaitPhone, parseOmanPhone, parseQatarPhone,
} from '../src/index'

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'ok' : r.error?.code)

describe('Qatar phone', () => {
  it.each([
    ['3312 3456', '+97433123456', 'mobile'],
    ['5550 0000', '+97455500000', 'mobile'],
    ['6612 3456', '+97466123456', 'mobile'],
    ['7712 3456', '+97477123456', 'mobile'],
    ['4412 3456', '+97444123456', 'landline'],
  ])('reads %s', (national, e164, type) => {
    for (const input of [national, `+974 ${national}`, `00974${national}`, `974${national}`]) {
      expect(parseQatarPhone(input)).toEqual({ ok: true, value: { e164, type } })
    }
  })
  it('reads Arabic-Indic digits', () => {
    expect(parseQatarPhone('+٩٧٤ ٣٣١٢ ٣٤٥٦').ok).toBe(true)
  })
  it('rejects a trunk 0, never silently reading it', () => {
    expect(code(parseQatarPhone('0 3312 3456'))).toBe('unknown_prefix')
    expect(code(parseQatarPhone('+974 0 3312 3456'))).toBe('unknown_prefix')
  })
  it('rejects prefixes next to the accepted ones', () => {
    for (const p of ['1', '2', '8', '9']) expect(code(parseQatarPhone(`${p}312 3456`))).toBe('unknown_prefix')
  })
  it('rejects wrong length, another country, letters, empty', () => {
    expect(code(parseQatarPhone('3312 345'))).toBe('invalid_length')
    expect(code(parseQatarPhone('+971 3312 3456'))).toBe('not_qatar')
    expect(code(parseQatarPhone('33CALL'))).toBe('invalid_characters')
    expect(code(parseQatarPhone(' '))).toBe('empty')
  })
  it('formats', () => {
    expect(formatQatarPhone('+97433123456')).toBe('3312 3456')
    expect(formatQatarPhone('33123456', { style: 'international' })).toBe('+974 3312 3456')
    expect(formatQatarPhone('33123456', { style: 'e164' })).toBe('+97433123456')
    expect(formatQatarPhone('12')).toBeNull()
    expect(isValidQatarPhone('33123456')).toBe(true)
    expect(isValidQatarPhone('13123456')).toBe(false)
  })
})

describe('Kuwait phone', () => {
  it.each([
    ['5001 2345', '+96550012345', 'mobile'],
    ['4100 0000', '+96541000000', 'mobile'],
    ['6012 3456', '+96560123456', 'mobile'],
    ['9012 3456', '+96590123456', 'mobile'],
    ['2234 5678', '+96522345678', 'landline'],
  ])('reads %s', (national, e164, type) => {
    for (const input of [national, `+965 ${national}`, `00965${national}`]) {
      expect(parseKuwaitPhone(input)).toEqual({ ok: true, value: { e164, type } })
    }
  })
  it('accepts 41 only, not 40 or 42', () => {
    expect(code(parseKuwaitPhone('4000 0000'))).toBe('unknown_prefix')
    expect(code(parseKuwaitPhone('4200 0000'))).toBe('unknown_prefix')
  })
  it('rejects neighbours, trunk 0, length, country', () => {
    for (const p of ['1', '3', '7', '8']) expect(code(parseKuwaitPhone(`${p}012 3456`))).toBe('unknown_prefix')
    expect(code(parseKuwaitPhone('0 5001 2345'))).toBe('unknown_prefix')
    expect(code(parseKuwaitPhone('5001 234'))).toBe('invalid_length')
    expect(code(parseKuwaitPhone('+974 5001 2345'))).toBe('not_kuwait')
  })
  it('reads Arabic-Indic digits and formats', () => {
    expect(parseKuwaitPhone('٥٠٠١٢٣٤٥').ok).toBe(true)
    expect(formatKuwaitPhone('50012345', { style: 'international' })).toBe('+965 5001 2345')
    expect(formatKuwaitPhone('+96550012345')).toBe('5001 2345')
    expect(formatKuwaitPhone('50012345', { style: 'e164' })).toBe('+96550012345')
    expect(formatKuwaitPhone('x')).toBeNull()
    expect(isValidKuwaitPhone('50012345')).toBe(true)
  })
})

describe('Bahrain phone', () => {
  it.each([
    ['3600 1234', '+97336001234', 'mobile'],
    ['3900 0000', '+97339000000', 'mobile'],
    ['3000 0000', '+97330000000', 'mobile'],
    ['1700 1234', '+97317001234', 'landline'],
    ['1300 1234', '+97313001234', 'landline'],
    ['1600 1234', '+97316001234', 'landline'],
    ['6600 1234', '+97366001234', 'unknown'],
    ['7700 1234', '+97377001234', 'unknown'],
  ])('reads %s', (national, e164, type) => {
    for (const input of [national, `+973 ${national}`, `00973${national}`]) {
      expect(parseBahrainPhone(input)).toEqual({ ok: true, value: { e164, type } })
    }
  })
  it('rejects every other prefix', () => {
    for (const p of ['10', '11', '12', '14', '15', '18', '2', '4', '5', '60', '70', '76', '78', '8', '9']) {
      const input = `${p}${'0'.repeat(8 - p.length)}`
      const expected = p === '60' ? 'ok' : 'unknown_prefix'
      // 6 is a whole block, so 60 is accepted
      expect(code(parseBahrainPhone(input))).toBe(expected)
    }
  })
  it('rejects trunk 0, length, country', () => {
    expect(code(parseBahrainPhone('0 3600 1234'))).toBe('unknown_prefix')
    expect(code(parseBahrainPhone('3600 123'))).toBe('invalid_length')
    expect(code(parseBahrainPhone('+968 3600 1234'))).toBe('not_bahrain')
  })
  it('formats', () => {
    expect(formatBahrainPhone('+97336001234')).toBe('3600 1234')
    expect(formatBahrainPhone('36001234', { style: 'international' })).toBe('+973 3600 1234')
    expect(formatBahrainPhone('36001234', { style: 'e164' })).toBe('+97336001234')
    expect(formatBahrainPhone('')).toBeNull()
    expect(isValidBahrainPhone('17001234')).toBe(true)
    expect(parseBahrainPhone('٣٦٠٠١٢٣٤').ok).toBe(true)
  })
})

describe('Oman phone', () => {
  it.each([
    ['9212 3456', '+96892123456', 'mobile'],
    ['7500 0000', '+96875000000', 'mobile'],
    ['7100 0000', '+96871000000', 'mobile'],
    ['7200 0000', '+96872000000', 'mobile'],
    ['7400 0000', '+96874000000', 'mobile'],
    ['7900 0000', '+96879000000', 'mobile'],
    ['9010 0000', '+96890100000', 'mobile'],
    ['9090 0000', '+96890900000', 'mobile'],
    ['9900 0000', '+96899000000', 'mobile'],
    ['2412 3456', '+96824123456', 'landline'],
    ['2100 0000', '+96821000000', 'landline'],
    ['2600 0000', '+96826000000', 'landline'],
  ])('reads %s', (national, e164, type) => {
    for (const input of [national, `+968 ${national}`, `00968${national}`]) {
      expect(parseOmanPhone(input)).toEqual({ ok: true, value: { e164, type } })
    }
  })
  it('rejects 900xxxxx and accepts 901xxxxx', () => {
    expect(code(parseOmanPhone('9000 0000'))).toBe('unknown_prefix')
    expect(code(parseOmanPhone('9010 0000'))).toBe('ok')
  })
  it('rejects 73xxxxxx, 70, 20, 27 and trunk 0', () => {
    for (const p of ['73', '70', '20', '27', '1', '3', '4', '5', '6', '8']) {
      expect(code(parseOmanPhone(`${p}${'0'.repeat(8 - p.length)}`))).toBe('unknown_prefix')
    }
    expect(code(parseOmanPhone('0 9212 3456'))).toBe('unknown_prefix')
  })
  it('rejects length and country', () => {
    expect(code(parseOmanPhone('9212 345'))).toBe('invalid_length')
    expect(code(parseOmanPhone('+973 9212 3456'))).toBe('not_oman')
  })
  it('formats mobiles and landlines', () => {
    expect(formatOmanPhone('92123456')).toBe('9212 3456')
    expect(formatOmanPhone('92123456', { style: 'international' })).toBe('+968 9212 3456')
    expect(formatOmanPhone('24123456')).toBe('24 123456')
    expect(formatOmanPhone('24123456', { style: 'international' })).toBe('+968 24 123456')
    expect(formatOmanPhone('24123456', { style: 'e164' })).toBe('+96824123456')
    expect(formatOmanPhone('x')).toBeNull()
    expect(isValidOmanPhone('92123456')).toBe(true)
    expect(parseOmanPhone('٩٢١٢٣٤٥٦').ok).toBe(true)
  })
})

describe('input too short to show its prefix', () => {
  it('is invalid_length, not unknown_prefix', () => {
    expect(code(parseOmanPhone('90'))).toBe('invalid_length')
    expect(code(parseOmanPhone('9'))).toBe('invalid_length')
    expect(code(parseKuwaitPhone('4'))).toBe('invalid_length')
    expect(code(parseBahrainPhone('7'))).toBe('invalid_length')
    expect(code(parseOmanPhone('+968 90'))).toBe('invalid_length')
  })
  it('still rejects a prefix that no completion can fix', () => {
    expect(code(parseOmanPhone('900'))).toBe('unknown_prefix')
    expect(code(parseKuwaitPhone('40'))).toBe('unknown_prefix')
    expect(code(parseQatarPhone('1'))).toBe('unknown_prefix')
    expect(code(parseBahrainPhone('0'))).toBe('unknown_prefix')
  })
})
