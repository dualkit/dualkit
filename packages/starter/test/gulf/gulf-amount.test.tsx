// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GulfAmount, readGulfAmount } from '../../gulf/gulf-amount'
import { Harness, SCRIPTS, expectNoAxeViolations, renderIn } from './helpers'

const NBSP = ' '
const exact = { normalizer: (text: string) => text }
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

describe('readGulfAmount', () => {
  it('reads an amount and formats it with format', () => {
    expect(readGulfAmount('1,250.5', { currency: 'AED' })).toEqual({ ok: true, value: { amount: 1250.5, formatted: `AED${NBSP}1,250.50` } })
    expect(readGulfAmount('1250.125', { currency: 'KWD', locale: 'ar', numerals: 'arab' })).toEqual({
      ok: true, value: { amount: 1250.125, formatted: `١٬٢٥٠٫١٢٥${NBSP}د.ك` },
    })
  })

  it('reads Arabic-Indic digits and the Arabic decimal sign', () => {
    expect(readGulfAmount('١٢٥٠٫٥', { currency: 'SAR' })).toMatchObject({ ok: true, value: { amount: 1250.5 } })
  })

  it('reads a negative amount', () => {
    expect(readGulfAmount('-12', { currency: 'AED' })).toMatchObject({ ok: true, value: { amount: -12, formatted: `-AED${NBSP}12.00` } })
  })

  it('refuses more decimals than the currency has', () => {
    expect(readGulfAmount('1.005', { currency: 'AED' })).toMatchObject({ ok: false, error: { code: 'too_many_decimals' } })
    expect(readGulfAmount('1.005', { currency: 'BHD' }).ok).toBe(true)
    expect(readGulfAmount('1.0005', { currency: 'OMR' })).toMatchObject({ ok: false, error: { code: 'too_many_decimals', message: 'OMR has 3 decimal places.' } })
  })

  it('returns empty and invalid_number', () => {
    expect(readGulfAmount('  ', { currency: 'AED' })).toMatchObject({ ok: false, error: { code: 'empty' } })
    expect(readGulfAmount('1.2.3', { currency: 'AED' })).toMatchObject({ ok: false, error: { code: 'invalid_number' } })
    expect(readGulfAmount('-', { currency: 'AED' })).toMatchObject({ ok: false, error: { code: 'invalid_number' } })
  })
})

describe('GulfAmount', () => {
  it('shows the formatted amount as the person types', async () => {
    const onResult = vi.fn()
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfAmount label="Amount" currency="KWD" {...p} onResult={onResult} />}</Harness>)
    await userEvent.type(field('Amount'), '1250.5')
    expect(screen.getByText(`KWD${NBSP}1,250.500`, exact).tagName).toBe('BDI')
    expect(onResult).toHaveBeenLastCalledWith({ ok: true, value: { amount: 1250.5, formatted: `KWD${NBSP}1,250.500` } })
  })

  it('pads to the currency decimals when the field loses focus', async () => {
    renderIn(SCRIPTS[0], <Harness>{(p) => <GulfAmount label="Amount" currency="BHD" {...p} />}</Harness>)
    await userEvent.type(field('Amount'), '12.5')
    await userEvent.tab()
    expect(field('Amount').value).toBe('12.500')
  })

  it('leaves an invalid value alone on blur and shows the error', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <GulfAmount label="Amount" currency="AED" value="1.005" onChange={onChange} errorMessages={{ too_many_decimals: 'Two decimals at most.' }} />)
    fireEvent.blur(field('Amount'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Two decimals at most.')).toBeTruthy()
  })

  it('puts the code before the number in English and the abbreviation after it in Arabic', () => {
    renderIn(SCRIPTS[0], <GulfAmount label="Amount" currency="AED" value="" onChange={() => {}} />)
    const en = field('Amount').parentElement!
    expect(en.firstElementChild!.textContent).toBe('AED')
    renderIn(SCRIPTS[1], <GulfAmount label="المبلغ" currency="AED" locale="ar" value="" onChange={() => {}} />)
    const ar = field('المبلغ').parentElement!
    expect(ar.lastElementChild!.textContent).toBe('د.إ')
  })

  it('takes Arabic-Indic digits and shows them with the Arabic preview', () => {
    const onChange = vi.fn()
    const { rerender } = renderIn(SCRIPTS[1], <GulfAmount label="المبلغ" currency="SAR" locale="ar" numerals="arab" value="" onChange={onChange} />)
    fireEvent.change(field('المبلغ'), { target: { value: '١٢٥٠٫٥' } })
    expect(onChange).toHaveBeenLastCalledWith('1250.5')
    rerender(<div dir="rtl" lang="ar"><GulfAmount label="المبلغ" currency="SAR" locale="ar" numerals="arab" value="1250.5" onChange={onChange} /></div>)
    expect(field('المبلغ').value).toBe('١٢٥٠٫٥')
    expect(screen.getByText(`١٬٢٥٠٫٥٠${NBSP}ر.س`, exact)).toBeTruthy()
  })

  it('drops letters as they are typed', () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <GulfAmount label="Amount" currency="AED" value="" onChange={onChange} />)
    fireEvent.change(field('Amount'), { target: { value: '12a.5' } })
    expect(onChange).toHaveBeenLastCalledWith('12.5')
  })

  it('keeps the figure left to right inside an Arabic page', () => {
    renderIn(SCRIPTS[1], <GulfAmount label="المبلغ" currency="AED" locale="ar" value="5" onChange={() => {}} />)
    expect(field('المبلغ').getAttribute('dir')).toBe('ltr')
    // Arabic-Indic digit groups count as Arabic numbers, so spaces or hyphens between them would flip their order.
    expect(field('المبلغ').style.unicodeBidi).toBe('bidi-override')
    expect(field('المبلغ').getAttribute('inputmode')).toBe('decimal')
  })

  it('has no axe violations in either direction', async () => {
    for (const script of SCRIPTS) {
      const locale = script.dir === 'rtl' ? 'ar' : 'en'
      const { container, unmount } = renderIn(script, <GulfAmount label="L" currency="OMR" locale={locale} value="3.5" onChange={() => {}} help="h" />)
      await expectNoAxeViolations(container)
      unmount()
    }
  })
})
