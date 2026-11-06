// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GulfIbanInput } from '../../gulf/gulf-iban-input'
import { Harness, SCRIPTS, expectNoAxeViolations, renderIn } from './helpers'

const AE = 'AE070331234567890123456'
const english = { label: 'IBAN' }
const arabic = { label: 'رقم الآيبان' }
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

describe('GulfIbanInput', () => {
  it('groups the IBAN in fours as you type and stores it without spaces', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfIbanInput {...english} value={p.value} onChange={(v) => { onChange(v); p.onChange(v) }} />}</Harness>)
    await userEvent.type(field('IBAN'), 'ae070331')
    expect(field('IBAN').value).toBe('AE07 0331')
    expect(onChange).toHaveBeenLastCalledWith('AE070331')
  })

  it('reports format\'s result for a valid IBAN', () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <GulfIbanInput {...english} value="" onChange={() => {}} onResult={onResult} />)
    fireEvent.change(field('IBAN'), { target: { value: 'AE07 0331 2345 6789 0123 456' } })
    expect(onResult).toHaveBeenLastCalledWith({
      ok: true,
      value: { country: 'AE', electronic: AE, formatted: 'AE07 0331 2345 6789 0123 456', bankCode: '033' },
    })
  })

  it('reports checksum, length and country errors', () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <GulfIbanInput {...english} value="" onChange={() => {}} onResult={onResult} country="AE" />)
    const codes = ['AE070331234567890123457', 'AE07033123456789012345', 'SA0380000000608010167519', 'GB82WEST12345698765432'].map((v) => {
      fireEvent.change(field('IBAN'), { target: { value: v } })
      return onResult.mock.lastCall?.[0].error.code
    })
    expect(codes).toEqual(['invalid_checksum', 'invalid_length', 'wrong_country', 'unsupported_country'])
  })

  it('reads Arabic-Indic digits and shows them when asked', () => {
    const onChange = vi.fn()
    const { rerender } = renderIn(SCRIPTS[1], <GulfIbanInput {...arabic} value="" onChange={onChange} />)
    fireEvent.change(field('رقم الآيبان'), { target: { value: 'AE٠٧٠٣٣١' } })
    expect(onChange).toHaveBeenLastCalledWith('AE070331')
    rerender(<div dir="rtl" lang="ar"><GulfIbanInput {...arabic} value="AE070331" onChange={onChange} numerals="arab" /></div>)
    expect(field('رقم الآيبان').value).toBe('AE٠٧ ٠٣٣١')
  })

  it('drops characters an IBAN never has', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <GulfIbanInput {...english} value="" onChange={onChange} />)
    fireEvent.change(field('IBAN'), { target: { value: 'AE07-0331#' } })
    expect(onChange).toHaveBeenLastCalledWith('AE070331')
  })

  it('keeps the value left to right and isolated inside an Arabic page', () => {
    renderIn(SCRIPTS[1], <GulfIbanInput {...arabic} value={AE} onChange={() => {}} />)
    expect(field('رقم الآيبان').getAttribute('dir')).toBe('ltr')
    // Arabic-Indic digit groups count as Arabic numbers, so spaces or hyphens between them would flip their order.
    expect(field('رقم الآيبان').style.unicodeBidi).toBe('bidi-override')
    expect(field('رقم الآيبان').getAttribute('autocapitalize')).toBe('characters')
  })

  it('Backspace after a space removes the character before it', async () => {
    renderIn(SCRIPTS[0], <Harness initial="AE070331">{(p) => <GulfIbanInput {...english} {...p} />}</Harness>)
    const input = field('IBAN')
    input.focus()
    input.setSelectionRange(5, 5)
    await userEvent.keyboard('{Backspace}')
    expect(input.value).toBe('AE00 331')
    expect(input.selectionStart).toBe(3)
  })

  it('Delete before a space removes the character after it', async () => {
    renderIn(SCRIPTS[0], <Harness initial="AE070331">{(p) => <GulfIbanInput {...english} {...p} />}</Harness>)
    const input = field('IBAN')
    input.focus()
    input.setSelectionRange(4, 4)
    await userEvent.keyboard('{Delete}')
    expect(input.value).toBe('AE07 331')
    expect(input.selectionStart).toBe(4)
  })

  it('keeps the caret in place when typing in the middle', async () => {
    renderIn(SCRIPTS[0], <Harness initial="AE07033">{(p) => <GulfIbanInput {...english} {...p} />}</Harness>)
    const input = field('IBAN')
    input.focus()
    input.setSelectionRange(2, 2)
    await userEvent.keyboard('9')
    expect(input.value).toBe('AE90 7033')
    expect(input.selectionStart).toBe(3)
  })

  it('shows mapped error copy after blur', () => {
    renderIn(SCRIPTS[1], <GulfIbanInput {...arabic} value="AE070331234567890123457" onChange={() => {}} errorMessages={{ invalid_checksum: 'تحقق من الرقم' }} />)
    fireEvent.blur(field('رقم الآيبان'))
    expect(screen.getByText('تحقق من الرقم')).toBeTruthy()
  })

  it('has no axe violations in either direction', async () => {
    for (const script of SCRIPTS) {
      const props = script.dir === 'rtl' ? arabic : english
      const { container, unmount } = renderIn(script, <GulfIbanInput {...props} value={AE} onChange={() => {}} help="h" />)
      await expectNoAxeViolations(container)
      unmount()
    }
  })
})
