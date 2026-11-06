// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GulfPhoneInput, readGulfPhone } from '../../gulf/gulf-phone-input'
import { Harness, SCRIPTS, expectNoAxeViolations, renderIn } from './helpers'

describe('readGulfPhone', () => {
  it.each([
    ['50 123 4567', 'AE', '+971501234567'],
    ['050 123 4567', 'AE', '+971501234567'],
    ['55 123 4567', 'SA', '+966551234567'],
    ['3312 3456', 'QA', '+97433123456'],
    ['5001 2345', 'KW', '+96550012345'],
    ['1700 1234', 'BH', '+97317001234'],
    ['9212 3456', 'OM', '+96892123456'],
  ] as const)('reads %s as a national number in %s', (input, country, e164) => {
    expect(readGulfPhone(input, country)).toMatchObject({ ok: true, value: { country, e164 } })
  })

  it('lets a typed country code win over the picked country', () => {
    expect(readGulfPhone('+966 55 123 4567', 'AE')).toMatchObject({ ok: true, value: { country: 'SA' } })
    expect(readGulfPhone('00974 3312 3456', 'AE')).toMatchObject({ ok: true, value: { country: 'QA' } })
  })

  it('reads Arabic-Indic digits', () => {
    expect(readGulfPhone('٠٥٠ ١٢٣ ٤٥٦٧', 'AE')).toMatchObject({ ok: true, value: { e164: '+971501234567' } })
  })

  it('returns the format error codes unchanged', () => {
    expect(readGulfPhone('', 'AE')).toMatchObject({ ok: false, error: { code: 'empty' } })
    expect(readGulfPhone('50 123', 'AE')).toMatchObject({ ok: false, error: { code: 'invalid_length' } })
    expect(readGulfPhone('+44 20 7946 0000', 'AE')).toMatchObject({ ok: false, error: { code: 'not_gulf' } })
    expect(readGulfPhone('abc', 'AE')).toMatchObject({ ok: false, error: { code: 'invalid_characters' } })
  })
})

const english = { label: 'Mobile number', countryLabel: 'Country code' }
const arabic = { label: 'رقم الجوال', countryLabel: 'رمز الدولة' }

describe('GulfPhoneInput', () => {
  it('reports the parsed result as the person types', async () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfPhoneInput {...english} {...p} onResult={onResult} />}</Harness>)
    await userEvent.type(screen.getByLabelText('Mobile number'), '501234567')
    expect(onResult).toHaveBeenLastCalledWith({ ok: true, value: { country: 'AE', e164: '+971501234567', type: 'mobile' } })
  })

  it('stores Western digits when Arabic-Indic digits are typed', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('رقم الجوال'), { target: { value: '٠٥٠١٢٣٤٥٦٧' } })
    expect(onChange).toHaveBeenLastCalledWith('0501234567')
  })

  it('shows Arabic-Indic digits when asked, and keeps the stored value Western', () => {
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="0501234567" onChange={() => {}} numerals="arab" />)
    expect((screen.getByLabelText('رقم الجوال') as HTMLInputElement).value).toBe('٠٥٠١٢٣٤٥٦٧')
  })

  it('keeps the number left to right inside an Arabic page', () => {
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="" onChange={() => {}} />)
    const input = screen.getByLabelText('رقم الجوال')
    expect(input.getAttribute('dir')).toBe('ltr')
    // Arabic-Indic digit groups count as Arabic numbers, so spaces or hyphens between them would flip their order.
    expect(input.style.unicodeBidi).toBe('bidi-override')
    expect(input.parentElement?.closest('[dir="ltr"]')?.contains(screen.getByLabelText('رمز الدولة'))).toBe(true)
    expect(input.getAttribute('inputmode')).toBe('tel')
    expect(input.getAttribute('autocomplete')).toBe('tel-national')
  })

  it('lists the six GCC countries with their codes, and takes names as props', () => {
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="" onChange={() => {}} countryNames={{ AE: 'الإمارات' }} />)
    const options = [...(screen.getByLabelText('رمز الدولة') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(options).toEqual(['الإمارات +971', 'SA +966', 'QA +974', 'KW +965', 'BH +973', 'OM +968'])
  })

  it('reparses the number when the country changes', async () => {
    const onResult = vi.fn()
    const onCountryChange = vi.fn()
    renderIn(SCRIPTS[0], <GulfPhoneInput {...english} value="3312 3456" onChange={() => {}} onResult={onResult} onCountryChange={onCountryChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Country code'), 'QA')
    expect(onCountryChange).toHaveBeenCalledWith('QA')
    expect(onResult).toHaveBeenLastCalledWith({ ok: true, value: { country: 'QA', e164: '+97433123456', type: 'mobile' } })
  })

  it('follows a controlled country', () => {
    renderIn(SCRIPTS[0], <GulfPhoneInput {...english} value="" onChange={() => {}} country="OM" />)
    expect((screen.getByLabelText('Country code') as HTMLSelectElement).value).toBe('OM')
  })

  it('shows the mapped error after the field loses focus, not while typing', async () => {
    renderIn(SCRIPTS[0], (
      <Harness>{(p) => <GulfPhoneInput {...english} {...p} errorMessages={{ invalid_length: 'Too short.' }} help="We text a code." />}</Harness>
    ))
    const input = screen.getByLabelText('Mobile number')
    await userEvent.type(input, '50 12')
    expect(screen.queryByText('Too short.')).toBeNull()
    expect(screen.getByText('We text a code.')).toBeTruthy()
    await userEvent.tab()
    expect(screen.getByText('Too short.')).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Too short.').id)
  })

  it('falls back to the format message when no copy is given for a code', () => {
    renderIn(SCRIPTS[0], <GulfPhoneInput {...english} value="+44 20 7946 0000" onChange={() => {}} />)
    fireEvent.blur(screen.getByLabelText('Mobile number'))
    expect(screen.getByText('This is not a GCC number.')).toBeTruthy()
  })

  it('shows an error passed in at once', () => {
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="" onChange={() => {}} error="الرقم مطلوب" />)
    expect(screen.getByText('الرقم مطلوب')).toBeTruthy()
    expect(screen.getByLabelText('رقم الجوال').getAttribute('aria-invalid')).toBe('true')
  })

  it('moves from the country to the number with Tab', async () => {
    renderIn(SCRIPTS[1], <GulfPhoneInput {...arabic} value="" onChange={() => {}} />)
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('رمز الدولة'))
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('رقم الجوال'))
  })

  it('has no axe violations in either direction', async () => {
    for (const script of SCRIPTS) {
      const props = script.dir === 'rtl' ? arabic : english
      const { container, unmount } = renderIn(script, <GulfPhoneInput {...props} value="50" onChange={() => {}} error="x" help="y" />)
      await expectNoAxeViolations(container)
      unmount()
    }
  })
})
