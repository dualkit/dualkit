import { describe, expect, it } from 'vitest'
import { parseKuwaitCivilId } from '../src/kuwait-civil-id'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

describe('parseKuwaitCivilId', () => {
  it.each(['290010112346', '2900 1011 2346', '٢٩٠٠١٠١١٢٣٤٦'])('reads %s with its birth date', (input) => {
    expect(parseKuwaitCivilId(input)).toEqual({
      ok: true,
      value: { digits: '290010112346', formatted: '290010112346', birthDate: '1990-01-01' },
    })
  })

  it('reads the century from the first digit', () => {
    expect(parseKuwaitCivilId('305122500019')).toMatchObject({ ok: true, value: { birthDate: '2005-12-25' } })
  })

  it.each([
    ['', 'empty'],
    ['29001011234x', 'invalid_characters'],
    ['29001011234', 'invalid_length'],
    ['490010112346', 'invalid_prefix'],
    ['290023012345', 'invalid_birth_date'],
    ['290010112347', 'invalid_checksum'],
  ])('rejects %j with %s', (input, code) => {
    expect(parseKuwaitCivilId(input)).toMatchObject({ ok: false, error: { code } })
  })

  it.each(DIGITS.flatMap((d) => [`29001011237${d}`, `29001011232${d}`]))(
    'rejects %s, whose weighted check comes out as 10 or 11',
    (input) => {
      expect(parseKuwaitCivilId(input)).toMatchObject({ ok: false, error: { code: 'invalid_checksum' } })
    },
  )
})
