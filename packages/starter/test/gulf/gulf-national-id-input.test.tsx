// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
    expect(onResult).toHaveBeenLastCalledWith({ ok: true, value: { digits: '784199012345676', formatted: '784-1990-1234567-6', year: 1990 } })
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
      const props = script.dir === 'rtl' ? arabic : english
      const { container, unmount } = renderIn(script, <GulfNationalIdInput {...props} value="7841990" onChange={() => {}} error="e" />)
      await expectNoAxeViolations(container)
      unmount()
    }
  })
})
