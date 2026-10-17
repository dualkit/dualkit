import { describe, expect, it } from 'vitest'
import { MAX_PER_RULE, escapeHtml, renderReport } from '../src/report'
import { finding, result } from './helpers'

describe('renderReport', () => {
  it('shows the score, the page and each rule with its fix and docs link', () => {
    const html = renderReport(result([finding()]))
    expect(html).toContain('72')
    expect(html).toContain('https://example.com/ar')
    expect(html).toContain('A number that will show in reverse')
    expect(html).toContain('Wrap the number in &lt;bdi&gt;.')
    expect(html).toContain('RULES.md#bidi-unisolated-number')
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('escapes hostile page content so the report stays inert', () => {
    const html = renderReport(result([finding({ node: { id: 'x', snippet: '</script><img src=x onerror=alert(1)>', box: { x: 0, y: 0, width: 1, height: 1 } } })]))
    expect(html).not.toContain('<img src=x onerror')
    expect(html).toContain('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toMatch(/<script/i)
  })

  it(`shows at most ${MAX_PER_RULE} instances per rule, then says how many more`, () => {
    const html = renderReport(result(Array.from({ length: MAX_PER_RULE + 5 }, () => finding())))
    expect(html).toContain('And 5 more')
  })

  it('says when stylesheets could not be read, and celebrates a clean page', () => {
    expect(renderReport(result([], { unreadableStylesheets: 2 }))).toContain('2 stylesheets could not be read')
    expect(renderReport(result([], { score: 100 }))).toContain('No issues found')
  })

  it('loads nothing from the network', () => {
    const html = renderReport(result([finding()]))
    expect(html).not.toMatch(/<(link|script)[^>]+(src|href)=["']https?:/i)
  })

  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('clamps a marker so it never extends past the image bottom', () => {
    const f = finding({ node: { id: 'low', snippet: '<p>x</p>', box: { x: 0, y: 7990, width: 100, height: 100 } } })
    const html = renderReport(result([f], { pageHeight: 8000 }))
    const m = /class="mark [^"]*"[^>]*top:([\d.]+)%;width:[\d.]+%;height:([\d.]+)%/.exec(html)
    expect(m).not.toBeNull()
    expect(Number(m![1]) + Number(m![2])).toBeLessThanOrEqual(100.001)
  })

  it('draws no marker for a box below the screenshot', () => {
    const f = finding({ node: { id: 'gone', snippet: '<p>x</p>', box: { x: 0, y: 9000, width: 10, height: 10 } } })
    expect(renderReport(result([f], { pageHeight: 8000 }))).not.toContain('class="mark')
  })

  // The old expectation quoted the number as the page paints it (4567 123 050); measured in Chromium
  // (test/verify.test.ts), the report now shows it as typed, so the quote is isolated by its own script.
  it('isolates page text so mixed-direction messages do not reverse', () => {
    const html = renderReport(result([finding({ message: '"\u0631\u0642\u0645 050 123 4567" is not isolated.' })]))
    expect(html).toContain('<bdi dir="ltr">&quot;<bdi dir="rtl">\u0631\u0642\u0645 <bdi dir="ltr">050 123 4567</bdi></bdi>&quot; is not isolated.</bdi>')
    expect(html).toContain('<code dir="ltr">')
  })

  it('numbers each finding once, keeping the numbered anchors', () => {
    const html = renderReport(result([finding(), finding()]))
    expect(html).toMatch(/<li id="i1"><strong>1\.<\/strong>/)
    expect(html).toMatch(/ol\{[^}]*list-style:none/)
  })

  it('puts the badge inside the box when the marker is near the top', () => {
    const top = finding({ node: { id: 't', snippet: '<p>x</p>', box: { x: 0, y: 0, width: 10, height: 10 } } })
    const low = finding({ node: { id: 'l', snippet: '<p>x</p>', box: { x: 0, y: 100, width: 10, height: 10 } } })
    expect(renderReport(result([top]))).toMatch(/class="mark top error"/)
    expect(renderReport(result([low]))).not.toMatch(/class="mark top/)
  })
})
