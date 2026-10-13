// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DigitInput } from '../../components/DigitInput'
import { SCRIPTS, renderIn } from './helpers'

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[]
const shown = () => boxes().map((b) => b.value).join('')

describe.each(SCRIPTS)('DigitInput, $name', (script) => {
  const locale = script.lang as 'en' | 'ar'

  it('keeps the boxes left to right whatever the page direction', () => {
    renderIn(script, <DigitInput label="Code" locale={locale} />)
    expect(boxes()).toHaveLength(6)
    expect(boxes()[0]!.closest('[dir]')!.getAttribute('dir')).toBe('ltr')
  })

  it('reads Western digits as typed and moves along the boxes', async () => {
    const onComplete = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onComplete={onComplete} />)
    await userEvent.type(boxes()[0]!, '482913')
    expect(onComplete).toHaveBeenCalledWith('482913')
  })

  it('reads Arabic-Indic digits as typed', async () => {
    const onChange = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onChange={onChange} />)
    await userEvent.type(boxes()[0]!, '٤٨٢')
    expect(onChange).toHaveBeenLastCalledWith('482')
    expect(document.activeElement).toBe(boxes()[3])
  })

  it('reads Persian digits as typed', async () => {
    const onChange = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onChange={onChange} />)
    await userEvent.type(boxes()[0]!, '۴۸۲')
    expect(onChange).toHaveBeenLastCalledWith('482')
  })

  it('fills every box from a pasted code, in either digit system', async () => {
    const onComplete = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onComplete={onComplete} />)
    boxes()[0]!.focus()
    await userEvent.paste('٤٨٢ ٩١٣')
    expect(onComplete).toHaveBeenCalledWith('482913')
  })

  it('backspace on an empty box clears the one before and moves back', async () => {
    const onChange = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onChange={onChange} />)
    await userEvent.type(boxes()[0]!, '48')
    expect(document.activeElement).toBe(boxes()[2])
    await userEvent.keyboard('{Backspace}')
    expect(onChange).toHaveBeenLastCalledWith('4')
    expect(document.activeElement).toBe(boxes()[1])
  })

  it('ignores anything that is not a digit', async () => {
    const onChange = vi.fn()
    renderIn(script, <DigitInput label="Code" locale={locale} onChange={onChange} />)
    await userEvent.type(boxes()[0]!, 'a-')
    expect(onChange).not.toHaveBeenCalled()
    expect(shown()).toBe('')
  })

  it('marks every box invalid and shows the error', () => {
    renderIn(script, <DigitInput label="Code" locale={locale} error="That code did not match." />)
    expect(boxes().every((b) => b.getAttribute('aria-invalid') === 'true')).toBe(true)
    expect(screen.getByText('That code did not match.')).toBeTruthy()
  })
})

describe('DigitInput numerals', () => {
  it('shows Western digits in English', async () => {
    renderIn(SCRIPTS[0], <DigitInput label="Code" locale="en" defaultValue="482" />)
    expect(shown()).toBe('482')
  })

  it('shows Arabic-Indic digits in Arabic and still reports Western ones', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[1], <DigitInput label="رمز التحقق" locale="ar" onChange={onChange} />)
    await userEvent.type(boxes()[0]!, '48')
    expect(shown()).toBe('٤٨')
    expect(onChange).toHaveBeenLastCalledWith('48')
  })

  it('names the group by its label and each box by position', () => {
    renderIn(SCRIPTS[0], <DigitInput label="Verification code" locale="en" />)
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeTruthy()
    expect(boxes()[0]!.getAttribute('aria-label')).toBe('Digit 1 of 6')
    expect(boxes()[0]!.getAttribute('autocomplete')).toBe('one-time-code')
  })

  it('moves with the arrow keys in box order', () => {
    renderIn(SCRIPTS[1], <DigitInput label="Code" locale="ar" />)
    boxes()[2]!.focus()
    fireEvent.keyDown(boxes()[2]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(boxes()[3])
    fireEvent.keyDown(boxes()[3]!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(boxes()[2])
  })

  it('overwrites one digit in the middle and keeps the rest', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <DigitInput label="Code" locale="en" defaultValue="482913" onChange={onChange} />)
    await userEvent.click(boxes()[1]!)
    await userEvent.keyboard('5')
    expect(onChange).toHaveBeenLastCalledWith('452913')
    expect(document.activeElement).toBe(boxes()[2])
  })

  it('pasting into a middle box replaces from there on and keeps what follows', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <DigitInput label="Code" locale="en" defaultValue="482913" onChange={onChange} />)
    boxes()[2]!.focus()
    await userEvent.paste('77')
    expect(onChange).toHaveBeenLastCalledWith('487713')
  })

  it('clearing a middle digit closes the gap', async () => {
    const onChange = vi.fn()
    renderIn(SCRIPTS[0], <DigitInput label="Code" locale="en" defaultValue="482913" onChange={onChange} />)
    await userEvent.click(boxes()[2]!)
    await userEvent.keyboard('{Delete}')
    expect(onChange).toHaveBeenLastCalledWith('48913')
  })

  it('follows a controlled value', () => {
    const { rerender } = renderIn(SCRIPTS[0], <DigitInput label="Code" locale="en" value="12" />)
    expect(shown()).toBe('12')
    rerender(<div dir="ltr" lang="en"><DigitInput label="Code" locale="en" value="1234" /></div>)
    expect(shown()).toBe('1234')
  })
})
