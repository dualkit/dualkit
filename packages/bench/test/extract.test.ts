import { describe, expect, it } from 'vitest'
import { extractHtml } from '../src/extract'

const page = '<!doctype html><html dir="rtl"><body>مرحبا</body></html>'
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

describe('extractHtml', () => {
  it('takes an html fenced block', () => {
    expect(extractHtml(`Here you go:\n${fence('html', page)}\nEnjoy.`)).toBe(page)
  })
  it('picks the html block, not the first block, when there are several', () => {
    const reply = [fence('css', 'body{}'), fence('html', page), fence('js', 'x()')].join('\n')
    expect(extractHtml(reply)).toBe(page)
  })
  it('picks the longest html block', () => {
    expect(extractHtml([fence('html', '<b>x</b>'), fence('html', page)].join('\n'))).toBe(page)
  })
  it('accepts an untagged block that holds a document', () => {
    expect(extractHtml(fence('', page))).toBe(page)
  })
  it('accepts a bare document', () => {
    expect(extractHtml(`\n  ${page}`)).toBe(page)
  })
  it('ignores reasoning blocks', () => {
    expect(extractHtml(`<think>${fence('html', '<p>draft</p>')}</think>${fence('html', page)}`)).toBe(page)
  })
  it('returns null for prose or an unrelated block', () => {
    expect(extractHtml('I cannot help with that.')).toBeNull()
    expect(extractHtml(fence('js', 'console.log(1)'))).toBeNull()
  })
  it('handles a reply cut off before the closing fence', () => {
    expect(extractHtml('```html\n' + page)).toBe(page)
  })
})
