// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '../../components/Field'
import { SCRIPTS, renderIn } from './helpers'

const copy = {
  EN: { label: 'Email', help: 'We only use it to send receipts.', error: 'Enter a valid email address.' },
  AR: { label: 'البريد الإلكتروني', help: 'نستخدمه لإرسال الإيصالات فقط.', error: 'أدخل بريدًا إلكترونيًا صحيحًا.' },
}

describe.each(SCRIPTS)('Field, $name', (script) => {
  const c = copy[script.name]

  it('labels the input and lets its value pick its own direction', () => {
    renderIn(script, <Field label={c.label} defaultValue="sam@dualkit.dev" />)
    const input = screen.getByLabelText(c.label) as HTMLInputElement
    expect(input.getAttribute('dir')).toBe('auto')
    expect(input.value).toBe('sam@dualkit.dev')
  })

  it('describes the input with its help text', () => {
    renderIn(script, <Field label={c.label} help={c.help} />)
    const input = screen.getByLabelText(c.label)
    expect(input.getAttribute('aria-invalid')).toBe(null)
    expect(screen.getByText(c.help).id).toBe(input.getAttribute('aria-describedby'))
  })

  it('swaps the help for the error and marks the input invalid', () => {
    renderIn(script, <Field label={c.label} help={c.help} error={c.error} />)
    const input = screen.getByLabelText(c.label)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText(c.help)).toBeNull()
    expect(screen.getByText(c.error).id).toBe(input.getAttribute('aria-describedby'))
  })
})
