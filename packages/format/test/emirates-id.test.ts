import { describe, expect, it } from 'vitest'
import { formatEmiratesId, isValidEmiratesId, parseEmiratesId } from '../src/index'

describe('parseEmiratesId', () => {
  it.each(['784-1990-1234567-6', '784199012345676', '784 1990 1234567 6', '٧٨٤-١٩٩٠-١٢٣٤٥٦٧-٦'])(
    'reads %s',
    (input) => {
      expect(parseEmiratesId(input)).toEqual({
        ok: true,
        value: { digits: '784199012345676', formatted: '784-1990-1234567-6', year: 1990 },
      })
    },
  )

  it('rejects a wrong check digit', () => {
    expect(parseEmiratesId('784-1990-1234567-5')).toMatchObject({ ok: false, error: { code: 'invalid_checksum' } })
  })

  it('rejects a number that does not start with 784', () => {
    expect(parseEmiratesId('123-1990-1234567-6')).toMatchObject({ ok: false, error: { code: 'invalid_prefix' } })
  })

  it('rejects the wrong length', () => {
    expect(parseEmiratesId('784-1990-123456')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
  })

  it('rejects letters', () => {
    expect(parseEmiratesId('784-ABCD-1234567-6')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })

  it('rejects an empty value', () => {
    expect(parseEmiratesId('')).toMatchObject({ ok: false, error: { code: 'empty' } })
  })
})

describe('formatEmiratesId', () => {
  it('groups a valid number with dashes', () => {
    expect(formatEmiratesId('784200000000016')).toBe('784-2000-0000001-6')
  })

  it('returns null for an invalid number', () => {
    expect(formatEmiratesId('784200000000017')).toBeNull()
  })
})

describe('isValidEmiratesId', () => {
  it('answers yes or no', () => {
    expect(isValidEmiratesId('784-1985-1111111-8')).toBe(true)
    expect(isValidEmiratesId('784-1985-1111111-9')).toBe(false)
  })
})
