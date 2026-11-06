// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GulfHijriDate, readGulfDate } from '../../gulf/gulf-hijri-date'
import { Harness, SCRIPTS, expectNoAxeViolations, renderIn } from './helpers'

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const DUBAI = { timeZone: 'Asia/Dubai' }

describe('readGulfDate', () => {
  it('reads a date and gives its Umm al-Qura day from format', () => {
    const result = readGulfDate('2026-10-13', DUBAI)
    expect(result).toMatchObject({ ok: true, value: { iso: '2026-10-13', hijri: { year: 1448, month: 5, day: 2 } } })
  })

  it('accepts single-digit months and days, and Arabic-Indic digits', () => {
    expect(readGulfDate('2026-1-5', DUBAI)).toMatchObject({ ok: true, value: { iso: '2026-01-05' } })
    expect(readGulfDate('٢٠٢٦-١٠-١٣', DUBAI)).toMatchObject({ ok: true, value: { iso: '2026-10-13' } })
  })

  it('lands on the same calendar day in every time zone', () => {
    for (const timeZone of ['Asia/Dubai', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const result = readGulfDate('2026-10-13', { timeZone })
      expect(result, timeZone).toMatchObject({ ok: true, value: { hijri: { year: 1448, month: 5, day: 2 } } })
    }
  })

  it('returns empty, invalid_format and invalid_date', () => {
    expect(readGulfDate(' ', DUBAI)).toMatchObject({ ok: false, error: { code: 'empty' } })
    expect(readGulfDate('13/10/2026', DUBAI)).toMatchObject({ ok: false, error: { code: 'invalid_format' } })
    expect(readGulfDate('2026-02-30', DUBAI)).toMatchObject({ ok: false, error: { code: 'invalid_date' } })
    expect(readGulfDate('2026-13-01', DUBAI)).toMatchObject({ ok: false, error: { code: 'invalid_date' } })
  })

  it('needs a time zone, as format does', () => {
    expect(() => readGulfDate('2026-10-13', { timeZone: '' })).toThrow(/timeZone/)
  })
})

describe('GulfHijriDate', () => {
  it('shows Gregorian and Hijri side by side in English', async () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfHijriDate label="Start date" {...DUBAI} {...p} onResult={onResult} />}</Harness>)
    await userEvent.type(field('Start date'), '2026-10-13')
    expect(screen.getByText('13 October 2026').tagName).toBe('BDI')
    expect(screen.getByText('2 Jumada al-Awwal 1448 AH').tagName).toBe('BDI')
    expect(screen.getByText('13 October 2026').closest('time')?.getAttribute('datetime')).toBe('2026-10-13')
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ ok: true }))
  })

  it('shows Arabic names and digits in Arabic', () => {
    renderIn(SCRIPTS[1], <GulfHijriDate label="تاريخ البدء" {...DUBAI} locale="ar" numerals="arab" value="2026-10-13" onChange={() => {}} />)
    expect(screen.getByText('١٣ أكتوبر ٢٠٢٦')).toBeTruthy()
    expect(screen.getByText('٢ جمادى الأولى ١٤٤٨ هـ')).toBeTruthy()
    expect(field('تاريخ البدء').value).toBe('٢٠٢٦-١٠-١٣')
  })

  it('labels each calendar with copy passed in', () => {
    renderIn(SCRIPTS[0], <GulfHijriDate label="Date" {...DUBAI} value="2026-10-13" onChange={() => {}} calendarLabels={{ gregorian: 'Gregorian', hijri: 'Hijri' }} />)
    expect(screen.getByText('Gregorian')).toBeTruthy()
    expect(screen.getByText('Hijri')).toBeTruthy()
  })

  it('stores Western digits when Arabic-Indic digits are typed', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[1], <GulfHijriDate label="التاريخ" {...DUBAI} value="" onChange={onChange} />)
    fireEvent.change(field('التاريخ'), { target: { value: '٢٠٢٦-١٠-١٣x' } })
    expect(onChange).toHaveBeenLastCalledWith('2026-10-13')
  })

  it('does not announce the dates on every keystroke', () => {
    renderIn(SCRIPTS[0], <GulfHijriDate label="Date" {...DUBAI} value="2026-10-13" onChange={() => {}} />)
    expect(document.querySelector('output')?.getAttribute('aria-live')).toBe('off')
  })

  it('shows nothing under the field until the date reads', () => {
    renderIn(SCRIPTS[0], <GulfHijriDate label="Date" {...DUBAI} value="2026-10" onChange={() => {}} />)
    expect(document.querySelector('time')).toBeNull()
  })

  it('shows the mapped error after blur', () => {
    renderIn(SCRIPTS[0], <GulfHijriDate label="Date" {...DUBAI} value="2026-02-30" onChange={() => {}} errorMessages={{ invalid_date: 'No such day.' }} />)
    fireEvent.blur(field('Date'))
    expect(screen.getByText('No such day.')).toBeTruthy()
  })

  it('keeps the typed date left to right inside an Arabic page', () => {
    renderIn(SCRIPTS[1], <GulfHijriDate label="التاريخ" {...DUBAI} value="" onChange={() => {}} />)
    expect(field('التاريخ').getAttribute('dir')).toBe('ltr')
    // Arabic-Indic digit groups count as Arabic numbers, so spaces or hyphens between them would flip their order.
    expect(field('التاريخ').style.unicodeBidi).toBe('bidi-override')
    // The override would also reverse an Arabic placeholder, so the placeholder opts out.
    expect(field('التاريخ').className).toContain('placeholder:[unicode-bidi:normal]')
  })

  it('has no axe violations in either direction', async () => {
    for (const script of SCRIPTS) {
      const locale = script.dir === 'rtl' ? 'ar' : 'en'
      const { container, unmount } = renderIn(script, <GulfHijriDate label="L" {...DUBAI} locale={locale} value="2026-10-13" onChange={() => {}} help="h" />)
      await expectNoAxeViolations(container)
      unmount()
    }
  })
})
