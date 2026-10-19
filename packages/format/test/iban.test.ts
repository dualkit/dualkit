import { describe, expect, it } from 'vitest'
import { formatIban, isValidIban, parseIban } from '../src/index'

describe('parseIban', () => {
  it('reads a UAE IBAN and its bank code', () => {
    expect(parseIban('AE07 0331 2345 6789 0123 456')).toEqual({
      ok: true,
      value: {
        country: 'AE',
        electronic: 'AE070331234567890123456',
        formatted: 'AE07 0331 2345 6789 0123 456',
        bankCode: '033',
      },
    })
  })

  it('reads a Saudi IBAN and its bank code', () => {
    expect(parseIban('sa0380000000608010167519')).toMatchObject({
      ok: true,
      value: { country: 'SA', electronic: 'SA0380000000608010167519', bankCode: '80' },
    })
  })

  it.each([
    'BH67BMAG00001299123456',
    'KW81CBKU0000000000001234560101',
    'QA58DOHB00001234567890ABCDEFG',
    'OM810180000001299123456',
    'OM840270000000000000001',
    'OM7801800000000TEST0001',
  ])('reads the Gulf IBAN %s', (input) => {
    expect(parseIban(input).ok).toBe(true)
  })

  it('reads Arabic-Indic digits', () => {
    expect(parseIban('AE٠٧٠٣٣١٢٣٤٥٦٧٨٩٠١٢٣٤٥٦').ok).toBe(true)
  })

  it('rejects a wrong check', () => {
    expect(parseIban('AE070331234567890123457')).toMatchObject({ ok: false, error: { code: 'invalid_checksum' } })
  })

  it('rejects the wrong length for the country', () => {
    expect(parseIban('AE07033123456789012345')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })

  it('rejects a country outside the Gulf', () => {
    expect(parseIban('GB82WEST12345698765432')).toMatchObject({ ok: false, error: { code: 'unsupported_country' } })
  })

  it('can insist on one country', () => {
    expect(parseIban('SA0380000000608010167519', { country: 'AE' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_country' },
    })
  })

  it('rejects punctuation inside the number', () => {
    expect(parseIban('AE07-0331-2345')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })

  it('rejects an empty value', () => {
    expect(parseIban(' ')).toMatchObject({ ok: false, error: { code: 'empty' } })
  })
})

describe('formatIban', () => {
  it('groups in fours', () => {
    expect(formatIban('SA0380000000608010167519')).toBe('SA03 8000 0000 6080 1016 7519')
  })

  it('returns null for an invalid IBAN', () => {
    expect(formatIban('AE070331234567890123457')).toBeNull()
  })
})

describe('isValidIban', () => {
  it('answers yes or no', () => {
    expect(isValidIban('AE070331234567890123456')).toBe(true)
    expect(isValidIban('AE070331234567890123457')).toBe(false)
  })
})

describe('Oman IBAN', () => {
  it('reads the bank code and rejects a wrong length', () => {
    expect(parseIban('OM81 0180 0000 0129 9123 456')).toMatchObject({ ok: true, value: { country: 'OM', bankCode: '018' } })
    expect(parseIban('OM8101800000012991234')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })
})
