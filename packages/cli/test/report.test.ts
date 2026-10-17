import { describe, expect, it } from 'vitest'
import { MAX_PER_RULE, escapeHtml, renderReport } from '../src/report'
import { finding, result } from './helpers'

const warning = (p = {}) => finding({ rule: 'type/arabic-size', group: 'type', severity: 'warning', title: 'Arabic set too small', ...p })
const pageLevel = finding({ rule: 'content/missing-lang', group: 'content', title: 'No language on the page', message: 'The page has no lang attribute.', node: null })
const cards = (html: string) => html.split('<article class="card ev ').slice(1).map((c) => c.split('</article>')[0]!)

describe('renderReport', () => {
  it('shows the score, the page and each rule with its fix and docs link', () => {
    const html = renderReport(result([finding()]))
    expect(html).toContain('72<small>/100</small>')
    expect(html).toContain('https://example.com/ar')
    expect(html).toContain('16 Oct 2026')
    expect(html).toContain('A number that will show in reverse')
    expect(html).toContain('Wrap the number in &lt;bdi&gt;.')
    expect(html).toContain('RULES.md#bidi-unisolated-number')
  })

  it('escapes hostile page content so the report stays inert', () => {
    const html = renderReport(result([finding({ node: { id: 'x', snippet: '</script><img src=x onerror=alert(1)>', box: { x: 0, y: 0, width: 1, height: 1 } } })], { url: 'https://x.test/"><script>alert(1)</script>' }))
    expect(html).not.toContain('<img src=x onerror')
    expect(html).toContain('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toMatch(/<script/i)
  })

  it('embeds a screenshot only when it is plain base64', () => {
    expect(renderReport(result([finding()], { screenshot: 'abc);}body{x:url(evil' }))).not.toContain('evil')
  })

  it(`shows at most ${MAX_PER_RULE} instances per rule, then says how many more`, () => {
    const html = renderReport(result(Array.from({ length: MAX_PER_RULE + 5 }, () => finding())))
    expect(html).toContain('And 5 more.')
    expect(html).toContain(`${MAX_PER_RULE + 4} more like this`)
    expect(html).not.toContain(`id="i${MAX_PER_RULE + 1}"`)
  })

  it('says when stylesheets could not be read, and celebrates a clean page', () => {
    expect(renderReport(result([], { unreadableStylesheets: 2 }))).toContain('2 stylesheets could not be read')
    const clean = renderReport(result([], { score: 100 }))
    expect(clean).toContain('No problems an Arabic reader will notice.')
    expect(clean).toContain('No issues found')
    expect(clean).not.toContain('<article')
  })

  it('loads nothing from the network and links only to the docs and dualkit.dev', () => {
    const html = renderReport(result([finding(), warning(), pageLevel]))
    expect(html).not.toMatch(/<(link|script|img|iframe)\b/i)
    const urls = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1]!)
    for (const u of urls) expect(u).toMatch(/^(#|https:\/\/dualkit\.dev\/?$|https:\/\/github\.com\/dualkit\/dualkit\/blob\/main\/packages\/rules\/RULES\.md)/)
    expect(html).not.toMatch(/url\((?!data:image\/png;base64,)/)
  })

  it('drops a docs link that is not https', () => {
    expect(renderReport(result([finding({ docs: 'javascript:alert(1)' })]))).not.toContain('javascript:')
  })

  it('embeds the screenshot exactly once, however many crops use it', () => {
    const html = renderReport(result([finding(), finding(), warning(), warning({ node: { id: 'q', snippet: '<p>q</p>', box: { x: 500, y: 600, width: 80, height: 20 } } })]))
    expect(html.split('data:image/png;base64,').length - 1).toBe(1)
    expect(html.match(/class="view crop/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it('has a dark palette and prints cards whole', () => {
    const html = renderReport(result([finding()]))
    expect(html).toContain('@media (prefers-color-scheme:dark)')
    expect(html).toMatch(/@media print\{[^]*break-inside:avoid/)
  })
})

describe('the hero', () => {
  it('states the verdict with correct plurals', () => {
    const many = renderReport(result([finding(), finding({ rule: 'bidi/unisolated-latin' }), warning()]))
    expect(many).toContain('3 problems an Arabic reader will notice.')
    expect(many).toContain('2 break the screen, 1 makes it feel translated.')
    const one = renderReport(result([finding()]))
    expect(one).toContain('1 problem an Arabic reader will notice.')
    expect(one).toContain('1 breaks the screen.')
  })

  it('counts failing and to-check rules and draws five family bars scaled to the largest', () => {
    const html = renderReport(result([finding(), finding(), warning(), warning(), warning(), warning({ rule: 'layout/physical-spacing', group: 'layout' })]))
    expect(html).toMatch(/<i class="dot error"><\/i>1 rule failing/)
    expect(html).toMatch(/<i class="dot warning"><\/i>2 rules to check/)
    const bars = Object.fromEntries([...html.matchAll(/data-family="(\w+)"[^]*?<b style="width:([\d.]+)%"><\/b><\/span><span class="n">(\d+)</g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]))
    expect(bars).toEqual({ bidi: [66.667, 2], layout: [33.333, 1], icons: [0, 0], type: [100, 3], content: [0, 0] })
  })
})

describe('evidence cards', () => {
  it('orders cards errors first, then warnings', () => {
    const html = renderReport(result([warning(), finding()]))
    const c = cards(html)
    expect(c[0]).toContain('Must fix')
    expect(c[1]).toContain('Worth checking')
  })

  it('crops around the first instance with the ring on the element box', () => {
    const html = renderReport(result([finding({ node: { id: 'p', snippet: '<p>x</p>', box: { x: 600, y: 400, width: 100, height: 20 } } })]))
    const card = cards(html)[0]!
    expect(card).toContain('class="view crop"')
    expect(card).toContain('aspect-ratio:360/150')
    expect(card).toContain('<span class="ring error" style="left:36.111%;top:43.333%;width:27.778%;height:13.333%"></span>')
    expect(card).toContain('background-size:355.556% auto;background-position:51.087% 23.103%')
  })

  it('lists more instances in a disclosure only when a rule has more than one', () => {
    const html = renderReport(result([finding(), finding(), warning()]))
    const [two, one] = cards(html)
    expect(two).toContain('<details')
    expect(two).toContain('1 more like this')
    expect(two!.match(/class="view crop/g)).toHaveLength(2)
    expect(one).not.toContain('<details')
  })

  it('gives a page-level finding a card with its message in place of a crop', () => {
    const card = cards(renderReport(result([pageLevel])))[0]!
    expect(card).not.toContain('class="view')
    expect(card).toContain('class="page-level"')
    expect(card).toContain('The page has no lang attribute.')
    expect(card).toContain('Wrap the number in &lt;bdi&gt;.')
  })

  it('isolates page text so mixed-direction messages do not reverse', () => {
    const html = renderReport(result([finding({ message: '"رقم 050 123 4567" is not isolated.' })]))
    expect(html).toContain('<bdi dir="ltr">&quot;<bdi dir="rtl">رقم <bdi dir="ltr">050 123 4567</bdi></bdi>&quot; is not isolated.</bdi>')
    expect(html).toContain('<code dir="ltr">')
  })

  it('numbers each finding once, keeping the numbered anchors', () => {
    const html = renderReport(result([finding(), finding()]))
    expect(html.match(/id="i1"/g)).toHaveLength(1)
    expect(html.match(/id="i2"/g)).toHaveLength(1)
    expect(html).toContain('href="#i2"')
  })
})

describe('the whole screen', () => {
  it('keeps every ring inside the image', () => {
    const f = finding({ node: { id: 'low', snippet: '<p>x</p>', box: { x: 0, y: 7990, width: 100, height: 100 } } })
    const whole = renderReport(result([f], { pageHeight: 8000 })).split('class="view whole"')[1]!
    const m = /class="ring [^"]*" style="left:[\d.]+%;top:([\d.]+)%;width:[\d.]+%;height:([\d.]+)%/.exec(whole)
    expect(m).not.toBeNull()
    expect(Number(m![1]) + Number(m![2])).toBeLessThanOrEqual(100.001)
  })

  it('draws no ring for a box below the screenshot', () => {
    const f = finding({ node: { id: 'gone', snippet: '<p>x</p>', box: { x: 0, y: 9000, width: 10, height: 10 } } })
    expect(renderReport(result([f], { pageHeight: 8000 }))).not.toContain('class="ring')
  })

  it('merges findings on the same element into one ring with a combined pin', () => {
    const box = { x: 300, y: 300, width: 120, height: 16 }
    const html = renderReport(result([finding({ node: { id: 'a', snippet: '<p>a</p>', box } }), warning({ node: { id: 'a', snippet: '<p>a</p>', box } })]))
    const whole = html.split('class="view whole"')[1]!
    expect(whole.match(/class="ring /g)).toHaveLength(1)
    expect(whole).toContain('<i>1·2</i>')
  })

  it('frames the area the findings are in, not the empty sides', () => {
    const html = renderReport(result([finding({ node: { id: 'a', snippet: '<p>a</p>', box: { x: 500, y: 300, width: 200, height: 20 } } })]))
    expect(html).toMatch(/class="view whole"[^>]*aspect-ratio:(\d+)\//)
    const w = Number(/class="view whole"[^>]*aspect-ratio:([\d.]+)\//.exec(html)![1])
    expect(w).toBeLessThan(1280)
    expect(w).toBeGreaterThan(200)
  })

  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})
