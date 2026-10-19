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

const nested = '<!doctype html><html><body><pre>\n```js\nx\n```\n</pre></body></html>'
const draft = '<!doctype html><html><body>' + 'draft '.repeat(40) + '</body></html>'

describe('extractHtml fence edges', () => {
  it('keeps a page that holds a nested fence, through its closing html tag', () => {
    expect(extractHtml(fence('html', nested))).toBe(nested)
  })
  it('takes a four-backtick html block whose body holds three-backtick lines', () => {
    expect(extractHtml('````html\n' + nested + '\n````')).toBe(nested)
  })
  it('does not start a block at an inline triple backtick in prose', () => {
    expect(extractHtml('Wrap the code in ``` fences, then:\n' + fence('html', page))).toBe(page)
  })
})

describe('extractHtml reasoning edges', () => {
  it('returns null for an unclosed think block holding a draft', () => {
    expect(extractHtml(`<think>\n${fence('html', draft)}`)).toBeNull()
  })
  it('drops everything up to a lone closing think tag', () => {
    expect(extractHtml(`reasoning\n${fence('html', draft)}\n</think>\n${fence('html', page)}`)).toBe(page)
  })
})
