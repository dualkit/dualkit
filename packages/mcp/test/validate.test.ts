import { parseEmiratesId, parseGulfPhone, parseIban, parseSaudiPhone, parseSaudiVatNumber } from '@dualkit/format'
import { describe, expect, it } from 'vitest'
import { expectPlainError, json, useClient } from './helpers'

const { call } = useClient()

describe('validate', () => {
  it('returns format\'s result for a valid IBAN unchanged', async () => {
    const value = 'AE07 0331 2345 6789 0123 456'
    expect(json(await call('validate', { kind: 'iban', value }))).toEqual(parseIban(value))
  })

  it('returns format\'s error for a bad IBAN as a result, not a tool error', async () => {
    const value = 'AE07 0331 2345 6789 0123 457'
    const out = json(await call('validate', { kind: 'iban', value }))
    expect(out).toEqual(parseIban(value))
    expect(out).toMatchObject({ ok: false, error: { code: 'invalid_checksum' } })
  })

  it('passes the IBAN country through', async () => {
    const value = 'AE07 0331 2345 6789 0123 456'
    expect(json(await call('validate', { kind: 'iban', value, country: 'SA' }))).toEqual(parseIban(value, { country: 'SA' }))
  })

  it.each(['784-1990-1234567-6', '784-1990-1234567-5'])('validates the Emirates ID %s', async (value) => {
    expect(json(await call('validate', { kind: 'emirates_id', value }))).toEqual(parseEmiratesId(value))
  })

  it.each(['3101 2345 6700 003', '12'])('validates the Saudi VAT number %s', async (value) => {
    expect(json(await call('validate', { kind: 'saudi_vat', value }))).toEqual(parseSaudiVatNumber(value))
  })

  it('validates a phone from any Gulf country', async () => {
    expect(json(await call('validate', { kind: 'phone', value: '+974 3312 3456' }))).toEqual(parseGulfPhone('+974 3312 3456'))
  })

  it('validates a phone for one country', async () => {
    expect(json(await call('validate', { kind: 'phone', value: '055 123 4567', country: 'SA' }))).toEqual(parseSaudiPhone('055 123 4567'))
  })

  it('rejects a country on a kind that has none', async () => {
    expect(expectPlainError(await call('validate', { kind: 'emirates_id', value: '784', country: 'AE' }))).toMatch(/country/)
  })

  it('needs a value as text', async () => {
    expect(expectPlainError(await call('validate', { kind: 'iban' }))).toMatch(/value/)
    expect(expectPlainError(await call('validate', { kind: 'iban', value: 42 }))).toMatch(/value/)
  })

  it('rejects an unknown kind', async () => {
    expect(expectPlainError(await call('validate', { kind: 'passport', value: 'X' }))).toMatch(/kind/)
  })

  it('rejects a country outside the Gulf', async () => {
    expect(expectPlainError(await call('validate', { kind: 'phone', value: '1', country: 'US' }))).toMatch(/country/)
  })
})
