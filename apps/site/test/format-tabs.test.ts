import { describe, expect, it } from 'vitest'
import { FORMAT_TABS, runTab } from '../lib/format-tabs'

const values = (r: ReturnType<typeof runTab>) => ('rows' in r ? r.rows.map((row) => row.value) : [])

describe('runTab', () => {
  it('has a sample for every tab that runs clean', () => {
    for (const tab of FORMAT_TABS) expect(runTab(tab.id, tab.sample)).toHaveProperty('rows')
  })

  it('has an Arabic-digit sample for every tab that gives the same result', () => {
    for (const tab of FORMAT_TABS) expect(values(runTab(tab.id, tab.arabicSample))).toEqual(values(runTab(tab.id, tab.sample)))
  })

  it('formats money in both languages and both currencies', () => {
    expect(values(runTab('money', '1234.5'))).toEqual(['AED 1,234.50', '١٬٢٣٤٫٥٠ د.إ', 'SAR 1,234.50', '1,234.50 ر.س'])
  })

  it('accepts grouped amounts', () => {
    expect(values(runTab('money', '12,000'))[0]).toBe('AED 12,000.00')
  })

  it('explains a bad amount', () => {
    expect(runTab('money', 'twelve')).toEqual({ error: 'Enter a number, in Western or Arabic digits.' })
  })

  it('reads a Hijri date on the Riyadh calendar day', () => {
    expect(values(runTab('hijri', '2026-02-18'))[0]).toBe('1 Ramadan 1447 AH')
  })

  it('explains a bad date', () => {
    expect(runTab('hijri', '18/02/2026')).toEqual({ error: 'Enter a date like 2026-02-18.' })
  })

  it('formats a phone and marks it valid', () => {
    const r = runTab('phone', '0501234567')
    expect(values(r)).toEqual(['050 123 4567', '+971 50 123 4567', '+971501234567', 'mobile'])
    expect(r).toMatchObject({ valid: true })
  })

  it('passes the library error through for a bad phone', () => {
    expect(runTab('phone', '0511234567')).toEqual({ error: 'No UAE mobile network uses this prefix.' })
  })

  it('masks an Emirates ID', () => {
    expect(values(runTab('emiratesId', '784199012345676'))).toEqual(['784-1990-1234567-6', '784-****-*******-6', '1990'])
  })

  it('reads an IBAN and its bank code', () => {
    expect(values(runTab('iban', 'AE070331234567890123456'))).toEqual(['AE07 0331 2345 6789 0123 456', 'AE', '033'])
  })
})
