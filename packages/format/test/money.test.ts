import { describe, expect, it } from 'vitest'
import { formatMoney } from '../src/index'

const NBSP = ' '

describe('formatMoney', () => {
  it('puts the code before the amount in English', () => {
    expect(formatMoney(1234.5, { currency: 'AED' })).toBe(`AED${NBSP}1,234.50`)
  })

  it('formats Saudi riyals', () => {
    expect(formatMoney(99, { currency: 'SAR' })).toBe(`SAR${NBSP}99.00`)
  })

  it('puts the Arabic abbreviation after the amount in Arabic', () => {
    expect(formatMoney(1234.5, { currency: 'AED', locale: 'ar' })).toBe(`1,234.50${NBSP}د.إ`)
    expect(formatMoney(1234.5, { currency: 'SAR', locale: 'ar' })).toBe(`1,234.50${NBSP}ر.س`)
  })

  it('uses Arabic-Indic digits when asked', () => {
    expect(formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' })).toBe(
      `١٬٢٣٤٫٥٠${NBSP}د.إ`,
    )
  })

  it('rounds to two decimal places', () => {
    expect(formatMoney(10.126, { currency: 'AED' })).toBe(`AED${NBSP}10.13`)
  })

  it('drops the decimals when fractionDigits is 0', () => {
    expect(formatMoney(1500, { currency: 'AED', fractionDigits: 0 })).toBe(`AED${NBSP}1,500`)
  })

  it('keeps the minus sign on the outside', () => {
    expect(formatMoney(-50, { currency: 'AED' })).toBe(`-AED${NBSP}50.00`)
  })

  it('isolates a negative Arabic amount so the minus stays on the number', () => {
    expect(formatMoney(-50, { currency: 'AED', locale: 'ar' })).toBe(`⁦-50.00⁩${NBSP}د.إ`)
  })

  it('formats Qatari riyals with two decimals', () => {
    expect(formatMoney(1234.5, { currency: 'QAR' })).toBe(`QAR${NBSP}1,234.50`)
    expect(formatMoney(1234.5, { currency: 'QAR', locale: 'ar' })).toBe(`1,234.50${NBSP}ر.ق`)
  })

  it.each([
    ['KWD', 'د.ك'],
    ['BHD', 'د.ب'],
    ['OMR', 'ر.ع'],
  ] as const)('gives %s three decimals by default', (currency, abbreviation) => {
    expect(formatMoney(1.5, { currency })).toBe(`${currency}${NBSP}1.500`)
    expect(formatMoney(1.5, { currency, locale: 'ar' })).toBe(`1.500${NBSP}${abbreviation}`)
  })

  it('shows three Arabic-Indic decimals for dinars', () => {
    expect(formatMoney(1.5, { currency: 'KWD', locale: 'ar', numerals: 'arab' })).toBe(`١٫٥٠٠${NBSP}د.ك`)
  })

  it('rounds dinars to the fils, not the hundredth', () => {
    expect(formatMoney(10.1236, { currency: 'BHD' })).toBe(`BHD${NBSP}10.124`)
  })

  it('still lets fractionDigits override the currency default', () => {
    expect(formatMoney(1500, { currency: 'OMR', fractionDigits: 0 })).toBe(`OMR${NBSP}1,500`)
  })

  it('refuses amounts that are not finite', () => {
    expect(() => formatMoney(Number.NaN, { currency: 'AED' })).toThrow(RangeError)
    expect(() => formatMoney(Number.POSITIVE_INFINITY, { currency: 'AED' })).toThrow(RangeError)
  })
})
