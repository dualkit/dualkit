import { describe, expect, it } from 'vitest'
import { parseQatarId } from '../src/qatar-id'

describe('parseQatarId', () => {
  it.each(['29063412345', '290 634 12345', '٢٩٠٦٣٤١٢٣٤٥'])('reads %s and decodes its fields', (input) => {
    expect(parseQatarId(input)).toEqual({
      ok: true,
      value: { digits: '29063412345', formatted: '29063412345', birthYear: '90', nationality: '634' },
    })
  })

  it('decodes a nationality code without checking it against a list', () => {
    expect(parseQatarId('29099912345')).toMatchObject({ ok: true, value: { nationality: '999' } })
  })

  it.each([
    ['', 'empty'],
    ['2906341234a', 'invalid_characters'],
    ['2906341234', 'invalid_length'],
    ['19063412345', 'invalid_prefix'],
  ])('rejects %j with %s', (input, code) => {
    expect(parseQatarId(input)).toMatchObject({ ok: false, error: { code } })
  })
})
