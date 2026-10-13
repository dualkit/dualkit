import { describe, expect, it } from 'vitest'
import { toArabicDigits, toWesternDigits } from '../src/index'

describe('toArabicDigits', () => {
  it('swaps every Western digit for its Arabic-Indic form', () => {
    expect(toArabicDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩')
  })

  it('accepts a number', () => {
    expect(toArabicDigits(2026)).toBe('٢٠٢٦')
  })

  it('swaps the decimal and grouping separators', () => {
    expect(toArabicDigits('1,234.50')).toBe('١٬٢٣٤٫٥٠')
  })

  it('leaves dots in a date alone', () => {
    expect(toArabicDigits('12.05.2026')).toBe('١٢.٠٥.٢٠٢٦')
  })

  it('leaves commas in a list alone', () => {
    expect(toArabicDigits('1,2,3')).toBe('١,٢,٣')
  })

  it('writes a large number in full, never in exponent form', () => {
    expect(toArabicDigits(1e21)).toBe('١٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠')
  })

  it('leaves letters alone', () => {
    expect(toArabicDigits('AED 5')).toBe('AED ٥')
  })
})

describe('toWesternDigits', () => {
  it('reads Arabic-Indic digits', () => {
    expect(toWesternDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
  })

  it('reads Persian digits, which some keyboards in the Gulf produce', () => {
    expect(toWesternDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789')
  })

  it('reads the Arabic separators', () => {
    expect(toWesternDigits('١٬٢٣٤٫٥٠')).toBe('1,234.50')
  })

  it('round-trips with toArabicDigits', () => {
    expect(toWesternDigits(toArabicDigits('9,876.01'))).toBe('9,876.01')
  })
})
