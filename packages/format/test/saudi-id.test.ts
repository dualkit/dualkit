import { describe, expect, it } from 'vitest'
import { parseSaudiId } from '../src/saudi-id'

describe('parseSaudiId', () => {
  it.each(['1012345672', '101 234 5672', '101-234-5672', '١٠١٢٣٤٥٦٧٢'])('reads %s as a citizen ID', (input) => {
    expect(parseSaudiId(input)).toEqual({
      ok: true,
      value: { digits: '1012345672', formatted: '1012345672', holder: 'citizen' },
    })
  })

  it('reads a number starting with 2 as an Iqama', () => {
    expect(parseSaudiId('2100000005')).toMatchObject({ ok: true, value: { holder: 'resident' } })
  })

  it.each([
    ['', 'empty'],
    ['10123A5672', 'invalid_characters'],
    ['101234567', 'invalid_length'],
    ['3012345672', 'invalid_prefix'],
    ['1012345671', 'invalid_checksum'],
  ])('rejects %j with %s', (input, code) => {
    expect(parseSaudiId(input)).toMatchObject({ ok: false, error: { code } })
  })
})
