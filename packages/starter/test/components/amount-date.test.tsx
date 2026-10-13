// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Amount } from '../../components/Amount'
import { DateDisplay } from '../../components/DateDisplay'
import { SCRIPTS, renderIn } from './helpers'

const NBSP = '\u00a0'
/** Keep the no-break space: it is what holds the currency to its number. */
const exact = { normalizer: (text: string) => text }
const OCT_13_DUBAI = new Date('2026-10-13T08:00:00Z')

describe('Amount', () => {
  it('formats AED in English, isolated from the sentence', () => {
    renderIn(SCRIPTS[0], <Amount amount={1250} currency="AED" locale="en" label="Total due" />)
    const figure = screen.getByText(`AED${NBSP}1,250.00`, exact)
    expect(figure.tagName).toBe('BDI')
    expect(screen.getByText('Total due')).toBeTruthy()
  })

  it('formats AED in Arabic with Arabic-Indic digits', () => {
    renderIn(SCRIPTS[1], <Amount amount={1250} currency="AED" locale="ar" label="المبلغ المستحق" note="شامل ضريبة القيمة المضافة ٥٪" />)
    expect(screen.getByText(`١٬٢٥٠٫٠٠${NBSP}د.إ`, exact).tagName).toBe('BDI')
    expect(screen.getByText('شامل ضريبة القيمة المضافة ٥٪')).toBeTruthy()
  })

  it('formats SAR in both', () => {
    renderIn(SCRIPTS[1], <><Amount amount={1250} currency="SAR" locale="ar" /><Amount amount={1250} currency="SAR" locale="en" /></>)
    expect(screen.getByText(`١٬٢٥٠٫٠٠${NBSP}ر.س`, exact)).toBeTruthy()
    expect(screen.getByText(`SAR${NBSP}1,250.00`, exact)).toBeTruthy()
  })
})

describe('DateDisplay', () => {
  it('shows Gregorian over Hijri in English', () => {
    renderIn(SCRIPTS[0], <DateDisplay date={OCT_13_DUBAI} locale="en" label="Due date" zone="Gulf Standard Time" />)
    const primary = screen.getByText('Tue, 13 Oct 2026')
    expect(screen.getByText('2 Jumada al-Awwal 1448 AH')).toBeTruthy()
    expect(primary.closest('time')!.getAttribute('datetime')).toBe('2026-10-13')
    expect(screen.getByText('Gulf Standard Time')).toBeTruthy()
  })

  it('shows Arabic names and digits in Arabic', () => {
    renderIn(SCRIPTS[1], <DateDisplay date={OCT_13_DUBAI} locale="ar" label="تاريخ الاستحقاق" />)
    expect(screen.getByText('الثلاثاء، ١٣ أكتوبر ٢٠٢٦')).toBeTruthy()
    expect(screen.getByText('٢ جمادى الأولى ١٤٤٨ هـ')).toBeTruthy()
  })

  it('puts Hijri first when asked', () => {
    renderIn(SCRIPTS[0], <DateDisplay date={OCT_13_DUBAI} locale="en" calendar="hijri" />)
    const lines = [...document.querySelectorAll('.dk-date__line')].map((n) => n.textContent)
    expect(lines).toEqual(['2 Jumada al-Awwal 1448 AH', 'Tue, 13 Oct 2026'])
  })

  it('reads the day in the Gulf, not in the browser', () => {
    renderIn(SCRIPTS[0], <DateDisplay date={new Date('2026-10-12T21:00:00Z')} locale="en" />)
    expect(screen.getByText('Tue, 13 Oct 2026')).toBeTruthy()
  })

  it('refuses an invalid date instead of printing NaN', () => {
    expect(() => renderIn(SCRIPTS[0], <DateDisplay date={new Date('nope')} />)).toThrow(RangeError)
  })

  it('takes another time zone', () => {
    renderIn(SCRIPTS[0], <DateDisplay date={new Date('2026-10-12T21:00:00Z')} locale="en" timeZone="UTC" />)
    expect(screen.getByText('Mon, 12 Oct 2026')).toBeTruthy()
  })
})
