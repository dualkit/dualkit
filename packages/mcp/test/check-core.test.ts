import { describe, expect, it } from 'vitest'
import { checkMarkup } from '../src/check-core'

const page = (body: string, attrs = 'lang="ar" dir="rtl"') => `<!doctype html><html ${attrs}><head><title>t</title></head><body>${body}</body></html>`
const rules = (html: string) => checkMarkup(html).map((f) => f.rule)
const phone = '<p>اتصل على <span>050 123 4567</span></p>'

/** The checks the tool runs in its worker, run here in the test thread so coverage sees them. */
describe('checkMarkup', () => {
  it('finds an unisolated number and names the element without a box', () => {
    const finding = checkMarkup(page(phone)).find((f) => f.rule === 'bidi/unisolated-number')
    expect(finding?.node).toEqual({ id: expect.any(String), snippet: '<span>050 123 4567</span>' })
  })

  it('inherits direction from dir, from CSS and from dir="auto"', () => {
    expect(rules(page(`<div dir="rtl">${phone}</div>`, 'lang="ar"'))).toContain('bidi/unisolated-number')
    expect(rules(page(`<style>.r{direction:rtl}</style><div class="r">${phone}</div>`, 'lang="ar"'))).toContain('bidi/unisolated-number')
    expect(rules(page(`<div dir="auto">${phone}</div>`, 'lang="ar"'))).toContain('bidi/unisolated-number')
    expect(rules(page('<div dir="auto">Call <span>050 123 4567</span></div>', 'lang="ar"'))).not.toContain('bidi/unisolated-number')
  })

  // jsdom's own parser recurses per level and overflows near 10,000 levels, and the reader slows down with depth, so this stays well under that.
  it('reads a deeply nested page', () => {
    const depth = 500
    const html = page(`${'<div>'.repeat(depth)}${phone}${'</div>'.repeat(depth)}`)
    expect(rules(html)).toContain('bidi/unisolated-number')
  })

  it('skips text that is not displayed and words split across elements', () => {
    expect(rules(page(`<div style="display:none">${phone}</div>`))).not.toContain('bidi/unisolated-number')
    expect(rules(page('<p style="font-family:serif">كت<b style="display:inline-block;font-family:sans-serif">ب</b></p>'))).not.toContain('type/arabic-broken-join')
  })
})
