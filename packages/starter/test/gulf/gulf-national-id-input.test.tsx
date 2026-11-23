// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NATIONAL_ID_COUNTRIES } from '@dualkit/format'
import { GulfNationalIdInput } from '../../gulf/gulf-national-id-input'
import { Harness, SCRIPTS, expectNoAxeViolations, renderIn } from './helpers'

const english = { label: 'Emirates ID' }
const arabic = { label: 'رقم الهوية' }
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

describe('GulfNationalIdInput', () => {
  it('puts the hyphens in as you type and stores digits only', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfNationalIdInput {...english} value={p.value} onChange={(v) => { onChange(v); p.onChange(v) }} />}</Harness>)
    await userEvent.type(field('Emirates ID'), '78419901')
    expect(field('Emirates ID').value).toBe('784-1990-1')
    expect(onChange).toHaveBeenLastCalledWith('78419901')
  })

  it('reports the parsed ID from format', () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <GulfNationalIdInput {...english} value="" onChange={() => {}} onResult={onResult} />)
    fireEvent.change(field('Emirates ID'), { target: { value: '784-1990-1234567-6' } })
    expect(onResult).toHaveBeenLastCalledWith({
      ok: true,
      value: { country: 'AE', strength: 'checksum', digits: '784199012345676', formatted: '784-1990-1234567-6', year: 1990 },
    })
  })

  it('reads a Saudi ID without hyphens', async () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfNationalIdInput label="Saudi ID" country="SA" {...p} onResult={onResult} />}</Harness>)
    await userEvent.type(field('Saudi ID'), '1012345672')
    expect(field('Saudi ID').value).toBe('1012345672')
    expect(onResult.mock.lastCall?.[0]).toMatchObject({ ok: true, value: { country: 'SA', holder: 'citizen' } })
  })

  it('stops at the country length', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <GulfNationalIdInput label="Civil ID" country="KW" value="" onChange={onChange} />)
    fireEvent.change(field('Civil ID'), { target: { value: '2900101123469' } })
    expect(onChange).toHaveBeenLastCalledWith('290010112346')
  })

  it('shows the country example as the placeholder unless one is given', () => {
    const { unmount } = renderIn(SCRIPTS[0], <GulfNationalIdInput {...english} value="" onChange={() => {}} />)
    expect(field('Emirates ID').placeholder).toBe('784-1990-1234567-6')
    unmount()
    const saudi = renderIn(SCRIPTS[0], <GulfNationalIdInput label="Saudi ID" country="SA" value="" onChange={() => {}} />)
    expect(field('Saudi ID').placeholder).toBe('1012345672')
    saudi.unmount()
    renderIn(SCRIPTS[0], <GulfNationalIdInput label="Saudi ID" country="SA" placeholder="Your ID" value="" onChange={() => {}} />)
    expect(field('Saudi ID').placeholder).toBe('Your ID')
  })

  it('trims and rechecks the value when the country changes', () => {
    const onChange = vi.fn()
    const onResult = vi.fn()
    const props = { label: 'ID', value: '784199012345676', onChange, onResult }
    const { rerender } = renderIn(SCRIPTS[0], <GulfNationalIdInput {...props} />)
    rerender(<div dir={SCRIPTS[0].dir} lang={SCRIPTS[0].lang}><GulfNationalIdInput {...props} country="SA" /></div>)
    expect(onChange).toHaveBeenLastCalledWith('7841990123')
    expect(onResult.mock.lastCall?.[0]).toMatchObject({ ok: false, error: { code: 'invalid_prefix' } })
  })

  it('reports checksum, prefix and length errors', () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <GulfNationalIdInput {...english} value="" onChange={() => {}} onResult={onResult} />)
    const codes = ['784199012345675', '785199012345676', '7841990'].map((v) => {
      fireEvent.change(field('Emirates ID'), { target: { value: v } })
      return onResult.mock.lastCall?.[0].error.code
    })
    expect(codes).toEqual(['invalid_checksum', 'invalid_prefix', 'invalid_length'])
  })

  it('reads Arabic-Indic digits and stops at 15 digits', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[1], <GulfNationalIdInput {...arabic} value="" onChange={onChange} />)
    fireEvent.change(field('رقم الهوية'), { target: { value: '٧٨٤-١٩٩٠-١٢٣٤٥٦٧-٦٩٩' } })
    expect(onChange).toHaveBeenLastCalledWith('784199012345676')
  })

  it('shows Arabic-Indic digits when asked', () => {
    renderIn(SCRIPTS[1], <GulfNationalIdInput {...arabic} value="784199012345676" onChange={() => {}} numerals="arab" />)
    expect(field('رقم الهوية').value).toBe('٧٨٤-١٩٩٠-١٢٣٤٥٦٧-٦')
  })

  it('keeps the number left to right inside an Arabic page', () => {
    renderIn(SCRIPTS[1], <GulfNationalIdInput {...arabic} value="" onChange={() => {}} />)
    expect(field('رقم الهوية').getAttribute('dir')).toBe('ltr')
    // Arabic-Indic digit groups count as Arabic numbers, so spaces or hyphens between them would flip their order.
    expect(field('رقم الهوية').style.unicodeBidi).toBe('bidi-override')
    // The override would also reverse an Arabic placeholder, so the placeholder opts out.
    expect(field('رقم الهوية').className).toContain('placeholder:[unicode-bidi:normal]')
    expect(field('رقم الهوية').getAttribute('inputmode')).toBe('numeric')
  })

  it('Backspace after a hyphen removes the digit before it', async () => {
    renderIn(SCRIPTS[0], <Harness initial="78419901">{(p) => <GulfNationalIdInput {...english} {...p} />}</Harness>)
    const input = field('Emirates ID')
    input.focus()
    input.setSelectionRange(4, 4)
    await userEvent.keyboard('{Backspace}')
    expect(input.value).toBe('781-9901')
    expect(input.selectionStart).toBe(2)
  })

  it('shows mapped error copy after blur', () => {
    renderIn(SCRIPTS[1], <GulfNationalIdInput {...arabic} value="784199012345675" onChange={() => {}} errorMessages={{ invalid_checksum: 'تحقق من الرقم' }} />)
    fireEvent.blur(field('رقم الهوية'))
    expect(screen.getByText('تحقق من الرقم')).toBeTruthy()
  })

  it('has no axe violations in either direction', async () => {
    for (const script of SCRIPTS) {
      for (const country of NATIONAL_ID_COUNTRIES) {
        const props = script.dir === 'rtl' ? arabic : english
        const { container, unmount } = renderIn(script, <GulfNationalIdInput {...props} country={country} value="2900" onChange={() => {}} error="e" />)
        await expectNoAxeViolations(container)
        unmount()
      }
    }
  })
})
