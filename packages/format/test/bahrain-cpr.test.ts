import { describe, expect, it } from 'vitest'
import { parseBahrainCpr } from '../src/bahrain-cpr'

describe('parseBahrainCpr', () => {
  it.each(['900112345', '9001 12345', '٩٠٠١١٢٣٤٥'])('reads %s', (input) => {
    expect(parseBahrainCpr(input)).toEqual({ ok: true, value: { digits: '900112345', formatted: '900112345' } })
  })

  it.each([
    ['', 'empty'],
    ['90011234x', 'invalid_characters'],
    ['90011234', 'invalid_length'],
  ])('rejects %j with %s', (input, code) => {
    expect(parseBahrainCpr(input)).toMatchObject({ ok: false, error: { code } })
  })
})
