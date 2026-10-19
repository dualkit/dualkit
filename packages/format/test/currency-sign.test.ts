import { describe, expect, it } from 'vitest'
import { currencySign } from '../src/index'

describe('currencySign', () => {
  it('returns the Unicode sign for SAR, AED and OMR', () => {
    expect(currencySign('SAR')).toBe('⃁')
    expect(currencySign('AED')).toBe('⃃')
    expect(currencySign('OMR')).toBe('⃄')
  })
  it('returns null where no sign exists', () => {
    for (const c of ['QAR', 'KWD', 'BHD'] as const) expect(currencySign(c)).toBeNull()
  })
})
