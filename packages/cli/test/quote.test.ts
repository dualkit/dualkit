import { describe, expect, it } from 'vitest'
import { quoteDirection, renderExcerpt, renderMessage } from '../src/quote'

describe('quoted page text', () => {
  it('takes the direction of the majority script', () => {
    expect(quoteDirection('مرحبا Hi')).toBe('rtl')
    expect(quoteDirection('Hello مرحبا')).toBe('ltr')
    expect(quoteDirection('050 123 4567')).toBe('ltr')
  })

  it('isolates each left-to-right run as one piece, joining words and digit groups split by spaces', () => {
    const write = 'راسلنا عبر البريد الإلكتروني'
    expect(renderExcerpt(`${write} hi@example.com أو Customer Care`))
      .toBe(`<bdi dir="rtl">${write} <bdi dir="ltr">hi@example.com</bdi> أو <bdi dir="ltr">Customer Care</bdi></bdi>`)
    expect(renderExcerpt('اتصل +971 50 123 4567')).toBe('<bdi dir="rtl">اتصل <bdi dir="ltr">+971 50 123 4567</bdi></bdi>')
  })

  it('leaves Arabic-Indic digits in the Arabic run', () => {
    expect(renderExcerpt('رقم ٠٥٠')).toBe('<bdi dir="rtl">رقم ٠٥٠</bdi>')
  })

  it('keeps everything escaped, inside and outside the quotes', () => {
    const html = renderMessage('"<img src=x onerror=alert(1)> &amp;" is placeholder text <b>.')
    expect(html).not.toMatch(/<img|<b>/)
    expect(html).toContain('&lt;<bdi dir="ltr">img src=x onerror=alert(1)&gt;</bdi> &amp;<bdi dir="ltr">amp;</bdi>')
    expect(html.endsWith('&quot; is placeholder text &lt;b&gt;.')).toBe(true)
  })

  it('isolates every quote in a message and leaves messages without quotes plain', () => {
    expect(renderMessage('Line height is 1.20 on "مرحبا".')).toBe('Line height is 1.20 on &quot;<bdi dir="rtl">مرحبا</bdi>&quot;.')
    expect(renderMessage('The page has no lang attribute.')).toBe('The page has no lang attribute.')
  })
})
