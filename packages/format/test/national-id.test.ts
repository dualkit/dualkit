import { describe, expect, it } from 'vitest'
import {
  NATIONAL_ID_COUNTRIES, NATIONAL_ID_EXAMPLES, NATIONAL_ID_LENGTH,
  formatNationalId, isValidNationalId, parseEmiratesId, parseNationalId,
} from '../src/index'

describe('parseNationalId', () => {
  it('covers five countries and leaves Oman out', () => {
    expect(NATIONAL_ID_COUNTRIES).toEqual(['AE', 'SA', 'KW', 'QA', 'BH'])
  })

  it.each(NATIONAL_ID_COUNTRIES)('reads the %s example', (country) => {
    const result = parseNationalId(NATIONAL_ID_EXAMPLES[country], country)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.country).toBe(country)
    expect(result.value.digits).toHaveLength(NATIONAL_ID_LENGTH[country])
  })

  it.each([['AE', 'checksum'], ['SA', 'checksum'], ['KW', 'checksum'], ['QA', 'shape'], ['BH', 'shape']] as const)(
    'reports a %s check as %s',
    (country, strength) => {
      expect(parseNationalId(NATIONAL_ID_EXAMPLES[country], country)).toMatchObject({ ok: true, value: { strength } })
    },
  )

  it('keeps the Emirates ID fields', () => {
    const emirates = parseEmiratesId('784199012345676')
    if (!emirates.ok) throw new Error('fixture')
    expect(parseNationalId('784199012345676', 'AE')).toEqual({
      ok: true,
      value: { country: 'AE', strength: 'checksum', ...emirates.value },
    })
  })

  it('reads Arabic digits for every country', () => {
    for (const country of NATIONAL_ID_COUNTRIES) {
      const arabic = NATIONAL_ID_EXAMPLES[country].replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)))
      expect(isValidNationalId(arabic, country)).toBe(true)
    }
  })

  it('passes the country parser errors through', () => {
    expect(parseNationalId(NATIONAL_ID_EXAMPLES.SA, 'KW')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })
})

describe('formatNationalId', () => {
  it('hyphenates an Emirates ID', () => {
    expect(formatNationalId('784199012345676', 'AE')).toBe('784-1990-1234567-6')
  })

  it('returns null for an invalid number', () => {
    expect(formatNationalId('1012345671', 'SA')).toBeNull()
  })
})
