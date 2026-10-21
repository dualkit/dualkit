import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { rtlScoped } from '../src/dom/styles'
import { page } from './fixtures'
import { closeBrowser, modelOf, withPage } from './helpers/browser'

afterAll(closeBrowser)

const doc = (body: string, css = '', attrs = 'lang="ar" dir="rtl"') =>
  `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>body{margin:0;font:16px/1.7 sans-serif}${css}</style></head><body>${body}</body></html>`

const insetOf = async (body: string, css: string) =>
  (await modelOf(doc(`<div class="box">${body}</div>`, `.box{position:relative;width:600px;height:200px}${css}`))).layouts
    .find((l) => l.id === 'div#x')?.physical ?? []

describe('physical insets', () => {
  it('reports left:0 and right:0 on a positioned element', async () => {
    expect(await insetOf('<div id="x" class="x">نص</div>', '.x{position:absolute;left:0;top:0;width:100px}')).toEqual([{ property: 'left', value: '0px' }])
    expect(await insetOf('<div id="x" class="x">نص</div>', '.x{position:absolute;right:0;top:0;width:100px}')).toEqual([{ property: 'right', value: '0px' }])
  })

  it('does not report left:auto', async () => {
    expect(await insetOf('<div id="x" class="x">نص</div>', '.x{position:absolute;left:auto;top:0;width:100px}')).toEqual([])
  })

  it('does not report an element centred with left:50% and a -50% transform', async () => {
    expect(await insetOf('<div id="x" class="x">نص</div>', '.x{position:absolute;left:50%;top:0;width:100px;transform:translateX(-50%)}')).toEqual([])
  })

  it('does not report the Tailwind left-1/2 -translate-x-1/2 pattern', async () => {
    const tw = '.x{position:absolute;top:0;width:120px;--tw-translate-x:-50%;--tw-translate-y:0;left:calc(1/2*100%);translate:var(--tw-translate-x) var(--tw-translate-y)}'
    expect(await insetOf('<div id="x" class="x">نص</div>', tw)).toEqual([])
  })

  it('still reports left:50% when the element is not centred', async () => {
    expect(await insetOf('<div id="x" class="x">نص</div>', '.x{position:absolute;left:50%;top:0;width:100px}')).toEqual([{ property: 'left', value: '300px' }])
  })
})

describe('layout text', () => {
  it('records whether the element’s own text has Arabic', async () => {
    const m = await modelOf(doc('<p id="en">Hello</p><p id="ar">مرحبا</p>', 'p{text-align:left}'))
    expect(m.layouts.find((l) => l.id === 'p#en')?.hasArabicText).toBe(false)
    expect(m.layouts.find((l) => l.id === 'p#ar')?.hasArabicText).toBe(true)
  })
})

describe('field kinds', () => {
  it.each([
    ['cardholder_name', 'text'], ['country_code', 'text'], ['country-code', 'text'],
    ['card_number', 'code'], ['card-number', 'code'], ['iban', 'code'], ['otp', 'code'], ['postal_code', 'code'], ['promo-code', 'code'],
    ['postalCode', 'code'], ['zipCode', 'code'], ['otpCode', 'code'], ['promoCode', 'code'], ['verificationCode', 'code'],
    ['ibanNumber', 'code'], ['cardNumber', 'code'], ['postcode', 'code'], ['zipcode', 'code'],
    ['cardholderName', 'text'], ['countryCode', 'text'],
  ])('classifies name="%s" as %s', async (name, kind) => {
    const m = await modelOf(doc(`<input name="${name}">`))
    expect(m.fields[0]?.kind).toBe(kind)
  })

  it('reads the cc-number and one-time-code autocomplete hints as codes', async () => {
    const m = await modelOf(doc('<input autocomplete="cc-number"><input autocomplete="one-time-code"><input autocomplete="cc-name">'))
    expect(m.fields.map((f) => f.kind)).toEqual(['code', 'code', 'text'])
  })
})

const ruleIds = async (html: string, id: string) =>
  runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === id) }).map((f) => f.rule)

const ARABIC_LABEL = 'العربية'

describe('near misses in a real browser', () => {
  it('layout/arabic-ltr-block stays quiet on a language switcher in an English page', async () => {
    const html = page(`<ul><li><a href="/en">English</a></li><li><a href="/ar" lang="ar">${ARABIC_LABEL}</a></li></ul><p>Welcome to the shop.</p>`, { lang: 'en', dir: 'ltr' })
    expect(await ruleIds(html, 'layout/arabic-ltr-block')).toEqual([])
  })

  it('layout/text-align-left stays quiet on Latin text in an RTL element', async () => {
    const html = page('<p class="code">ORDER-2041</p>', { css: '.code{text-align:left}' })
    expect(await ruleIds(html, 'layout/text-align-left')).toEqual([])
  })

  it('layout/physical-inset catches left:0 and stays quiet on a centred element', async () => {
    const css = '.wrap{position:relative;height:100px}.a{position:absolute;top:0;left:0}.b{position:absolute;top:40px;left:50%;transform:translateX(-50%)}'
    const found = runRules(await modelOf(page('<div class="wrap"><span class="a">أ</span><span class="b">ب</span></div>', { css })), { rules: RULES.filter((r) => r.id === 'layout/physical-inset') })
    expect(found).toHaveLength(1)
    expect(found[0]?.node?.id).toContain('span.a')
  })
})

describe('joins', () => {
  const joinsOf = async (body: string) => (await modelOf(page(body))).joins
  it('stays quiet for a Hijri heh with tatweel in a flex item beside a label, and keeps a real word split in flex items', async () => {
    const row = (a: string, b: string) => `<div style="display:flex;gap:12px"><span>${a}</span><span style="display:inline-flex">${b}</span></div>`
    expect(await joinsOf(row('1447 \u0647\u0640', '\u0627\u0644\u062a\u0627\u0631\u064a\u062e'))).toEqual([])
    expect(await joinsOf(`<p>\u0645\u062d<span style="display:inline-flex">\u0645\u062f</span></p>`)).toHaveLength(1)
  })
  it('reads a word split by an inline-block or inline-flex box, and nothing else', async () => {
    const block = await joinsOf('<p>مح<span style="display:inline-block">مد</span></p>')
    expect(block).toHaveLength(1)
    expect(block[0]).toMatchObject({ reason: 'inline-block', word: 'محمد' })
    expect((await joinsOf('<p>مح<span style="display:inline-flex">مد</span></p>'))[0]).toMatchObject({ reason: 'other' })
    for (const inner of ['<span style="color:red">مد</span>', '<b>مد</b>', '<span style="padding-inline-start:2px">مد</span>']) {
      expect(await joinsOf(`<p>مح${inner}</p>`)).toEqual([])
    }
  })
  it('skips a gap, a letter that does not join, a line break and off-screen text', async () => {
    const box = 'style="display:inline-block"'
    expect(await joinsOf(`<p>مح <span ${box}>مد</span></p>`)).toEqual([])
    expect(await joinsOf(`<p>مر<span ${box}>مد</span></p>`)).toEqual([])
    expect(await joinsOf(`<p>مح<br><span ${box}>مد</span></p>`)).toEqual([])
    expect(await joinsOf(`<p>مح<span style="display:inline-block;visibility:hidden">مد</span></p>`)).toEqual([])
    expect(await joinsOf(`<p>mh<span ${box}>مد</span></p>`)).toEqual([])
  })
})

describe('joins across a font change are measured, not assumed', () => {
  it('stays quiet when the second family is the bold bytes of the first, which join in Chromium', async () => {
    const bold = readFileSync(new URL('./fonts/IBMPlexSansArabic-Bold.woff2', import.meta.url)).toString('base64')
    const css = `@font-face{font-family:"Plex BoldFam";src:url(data:font/woff2;base64,${bold}) format("woff2")}`
    expect((await modelOf(page('<p>مح<span style="font-family:\'Plex BoldFam\'">مد</span></p>', { css }))).joins).toEqual([])
  })
  it.each(['2px', '0.1em'])('measures the probe with the letter-spacing of the measured text (%s), so a join that holds stays quiet', async (spacing) => {
    const bold = readFileSync(new URL('./fonts/IBMPlexSansArabic-Bold.woff2', import.meta.url)).toString('base64')
    const css = `@font-face{font-family:"Plex BoldFam";src:url(data:font/woff2;base64,${bold}) format("woff2")}p{letter-spacing:${spacing}}`
    expect((await modelOf(page('<p>مح<span style="font-family:\'Plex BoldFam\'">مد</span></p>', { css }))).joins).toEqual([])
  })
  const installed = (family: string) => withPage(page('<p>x</p>'), async (p) =>
    p.evaluate((f) => {
      const w = (fam: string) => { const e = document.createElement('span'); e.style.cssText = `position:absolute;white-space:pre;font:32px ${fam}`; e.textContent = 'محمد'; document.body.append(e); const r = e.getBoundingClientRect().width; e.remove(); return r }
      return w(`"${f}",monospace`) !== w('monospace') || w(`"${f}",serif`) !== w('serif')
    }, family))
  it('reports Geeza Pro then Plex as one font-family join when Geeza Pro is installed', async (ctx) => {
    if (!(await installed('Geeza Pro'))) return ctx.skip('Geeza Pro is not installed on this machine')
    const m = await modelOf(page('<p><span style="font-family:\'Geeza Pro\'">مح</span>مد</p>'))
    expect(m.joins).toHaveLength(1)
    expect(m.joins[0]).toMatchObject({ reason: 'font-family' })
  })
  describe('under a scaled or zoomed ancestor, the probe is scaled with the letter', () => {
    const bold = readFileSync(new URL('./fonts/IBMPlexSansArabic-Bold.woff2', import.meta.url)).toString('base64')
    const css = `@font-face{font-family:"Plex BoldFam";src:url(data:font/woff2;base64,${bold}) format("woff2")}`
    const split = (wrapStyle: string, second: string) =>
      modelOf(page(`<div style="width:300px;margin:0 auto 0 0;${wrapStyle}"><p><span>مح</span><span style="font-family:'${second}'">مد</span></p></div>`, { css }))
    it.each(['transform:scale(.8);transform-origin:0 0', 'zoom:.8', 'transform:scale(2);transform-origin:0 0', 'zoom:2'])(
      'stays quiet for Plex Regular then Plex Bold, which joins: %s',
      async (wrapStyle) => { expect((await split(wrapStyle, 'Plex BoldFam')).joins).toEqual([]) },
    )
    for (const wrapStyle of ['transform:scale(2);transform-origin:0 0', 'transform:scale(.8);transform-origin:0 0', 'zoom:2']) {
      it(`still reports a Plex then Al Nile split when Al Nile is installed: ${wrapStyle}`, async (ctx) => {
        if (!(await installed('Al Nile'))) return ctx.skip('Al Nile is not installed on this machine')
        const m = await split(wrapStyle, 'Al Nile')
        expect(m.joins).toHaveLength(1)
        expect(m.joins[0]).toMatchObject({ reason: 'font-family' })
      })
    }
  })
  it('treats trailing harakat as part of the letter, and skips non-joining letters outside the basic block', async () => {
    const box = 'style="display:inline-block"'
    expect((await modelOf(page(`<p>مَ<span ${box}>مد</span></p>`))).joins).toHaveLength(1)
    for (const letter of ['\u0671', '\u0688', '\u0691', '\u0698', '\u06c6', '\u06c0', '\u06d5', '\u08ad']) {
      expect((await modelOf(page(`<p>م${letter}<span ${box}>مد</span></p>`))).joins).toEqual([])
    }
  })
})

describe('joining starts', () => {
  it('does not treat a combining mark or low alef as a letter that joins to the one before', async () => {
    const box = 'style="display:inline-block"'
    for (const start of ['ٰ', 'َ', 'ࢭ']) {
      expect((await modelOf(page(`<p>م<span ${box}>${start}</span></p>`))).joins).toEqual([])
    }
  })
})

describe('rtlScoped', () => {
  it.each([
    ':dir(rtl) .a', '[dir=rtl] .a', '[dir="rtl"] .a', "[dir='rtl'] .a", 'html[dir="rtl"] .a', '.rtl .a', 'html.rtl .a',
    '[lang^=ar] .a', '[lang^="ar"] .a', '[lang|=ar] .a', '[lang=ar] .a', ':lang(ar) .a', '.a:lang(ar-AE)',
  ])('treats %s as scoped', (selector) => expect(rtlScoped(selector)).toBe(true))

  it.each(['.a', '[dir=ltr] .a', '.rtl-fix .a', ':not([dir=rtl]) .a', '[lang^=en] .a', '[lang=arm] .a', 'div'])
  ('treats %s as unscoped', (selector) => expect(rtlScoped(selector)).toBe(false))
})

const layoutsOf = async (body: string, css: string, attrs?: string) => (await modelOf(doc(body, css, attrs))).layouts

describe('scoped and inline declarations', () => {
  const css = '[dir="rtl"] .a{margin-right:8px}:dir(rtl) .b{padding-left:4px}.rtl .c{position:relative;left:10px}html[lang^="ar"] .d{float:right}'
  const body = '<p class="a">نص</p><p class="b">نص</p><p class="c">نص</p><p class="d">نص</p>'

  it('gives no hit for rules scoped to right to left', async () => {
    expect((await layoutsOf(body, css, 'lang="ar" dir="rtl" class="rtl"')).filter((l) => l.physical.length > 0)).toEqual([])
  })

  it('still reports the same declarations when unscoped', async () => {
    const plain = '.a{margin-right:8px}.b{padding-left:4px}.c{position:relative;left:10px}.d{float:right}'
    const found = (await layoutsOf(body, plain)).filter((l) => l.physical.length > 0)
    expect(found).toHaveLength(4)
  })

  it('judges a comma list by the selector that matched the element', async () => {
    const list = '[dir="rtl"] .a, .b{margin-right:8px}'
    const found = (await layoutsOf('<p class="a">نص</p><p class="b">نص</p>', list)).filter((l) => l.physical.length > 0)
    expect(found.map((l) => l.id)).toEqual(['p.b'])
  })

  it('gives no hit for an inline style', async () => {
    expect((await layoutsOf('<p style="margin-left:12px">نص</p>', '')).filter((l) => l.physical.length > 0)).toEqual([])
  })
})

describe('unseen elements', () => {
  const small = '<p style="font-size:11px">نص صغير جدا هنا</p>'
  const ids = async (body: string, css = '') =>
    runRules(await modelOf(doc(body, css)), { rules: RULES.filter((r) => r.id === 'type/arabic-size') }).map((f) => f.rule)

  it('flags the small text when it is visible', async () => {
    expect(await ids(small)).toEqual(['type/arabic-size'])
  })

  it('skips an element translated off the right of the viewport', async () => {
    expect(await ids(`<div style="transform:translateX(110vw)">${small}</div>`)).toEqual([])
  })

  it('skips a slide fully outside an overflow hidden track', async () => {
    const track = `<div style="width:300px;overflow:hidden"><div style="display:flex;width:900px"><div style="width:300px"></div><div style="width:300px">${small}</div></div></div>`
    expect(await ids(track)).toEqual([])
  })

  it('keeps a slide that is inside the track', async () => {
    const track = `<div style="width:300px;overflow:hidden"><div style="display:flex;width:900px"><div style="width:300px">${small}</div></div></div>`
    expect(await ids(track)).toEqual(['type/arabic-size'])
  })

  it('keeps an absolute child that escapes a clipping ancestor it is not inside', async () => {
    const body = `<div style="width:100px;overflow:hidden"><div style="position:absolute;left:400px;top:0;width:300px">${small}</div></div>`
    expect(await ids(body)).toEqual(['type/arabic-size'])
  })
})

describe('text-align-left on what shows', () => {
  const run = async (body: string) =>
    (await ruleIds(doc(body, '.l{text-align:left}'), 'layout/text-align-left'))

  it('flags a wide block with short Arabic text', async () => {
    expect(await run('<div class="l" style="width:400px">مرحبا</div>')).toEqual(['layout/text-align-left'])
  })

  it('skips an inline-block that shrink-wraps the text', async () => {
    expect(await run('<div><span class="l" style="display:inline-block">مرحبا</span></div>')).toEqual([])
  })

  it('skips a block that is mostly digits and Latin', async () => {
    expect(await run('<div class="l" style="width:400px">مرحبا 12345 ABCDEFGH 67890</div>')).toEqual([])
  })
})

describe('arabic-tracking threshold', () => {
  const run = async (size: number, spacing: number) =>
    ruleIds(doc(`<p style="font-size:${size}px;letter-spacing:${spacing}px">نص عربي</p>`), 'type/arabic-tracking')

  it('ignores 0.15px at 16px', async () => expect(await run(16, 0.15)).toEqual([]))
  it('flags 0.5px at 9px', async () => expect(await run(9, 0.5)).toEqual(['type/arabic-tracking']))
  it('flags 0.4px at 16px (boundary is inclusive)', async () => expect(await run(16, 0.4)).toEqual(['type/arabic-tracking']))
})

describe('stable node ids', () => {
  const idOf = async (body: string, text: string) => (await modelOf(doc(body))).texts.find((t) => t.text === text)?.id

  it('prefers an element id', async () => expect(await idOf('<div><p id="one">واحد</p></div>', 'واحد')).toBe('p#one'))
  it('then data-testid', async () => expect(await idOf('<div><p data-testid="t1">واحد</p></div>', 'واحد')).toBe('p[data-testid="t1"]'))
  it('then a class combination unique on the page', async () =>
    expect(await idOf('<div><p class="a b">واحد</p><p class="a">اثنان</p></div>', 'واحد')).toBe('p.a.b'))
  it('falls back to the chain when classes repeat', async () =>
    expect(await idOf('<div><p class="a">واحد</p><p class="a">اثنان</p></div>', 'اثنان')).toBe('body > div > p.a:nth-of-type(2)'))
})

describe('fix round 1', () => {
  it.each(['.rtl\\:ml-2 .a', '.rtl\\/50 .a', '.rtl\\.x .a', ':not(:is([dir=rtl])) .x', '.h:not(:is([dir="rtl"]))'])
  ('treats %s as unscoped', (selector) => expect(rtlScoped(selector)).toBe(false))

  it('splits a selector list without breaking an escaped comma', async () => {
    const found = (await layoutsOf('<p class="d,e">نص</p><p class="f">نص</p>', '.d\\,e, .f{margin-right:8px}')).filter((l) => l.physical.length > 0)
    expect(found).toHaveLength(2)
  })

  const small = '<p style="font-size:11px">نص صغير جدا هنا</p>'
  const sizeIds = async (body: string) =>
    runRules(await modelOf(doc(body)), { rules: RULES.filter((r) => r.id === 'type/arabic-size') }).map((f) => f.rule)

  it('keeps painted content inside a scaled clipping box', async () => {
    const body = `<div style="width:300px;margin:0 auto 0 0;overflow:hidden;transform:scale(2);transform-origin:0 0"><div style="padding-left:200px">${small}</div></div>`
    expect(await sizeIds(body)).toEqual(['type/arabic-size'])
  })

  it('keeps a scaled element that is partly on screen', async () => {
    const body = `<div style="width:300px;margin:0 auto 0 0;transform:scale(2);transform-origin:0 0">${small}</div>`
    expect(await sizeIds(body)).toEqual(['type/arabic-size'])
  })

  it('keeps text in a display: contents element for joins', async () => {
    // The split comes from the inline-block, so it does not depend on which fonts the machine has.
    const m = await modelOf(doc('<p>مح<span style="display:contents">م<b style="display:inline-block">د</b></span></p>'))
    expect(m.joins).toHaveLength(1)
  })

  const idOf = async (body: string, text: string) => (await modelOf(doc(body))).texts.find((t) => t.text === text)?.id
  it('uses a unique, stable-looking id', async () => expect(await idOf('<p id="intro">واحد</p>', 'واحد')).toBe('p#intro'))
  it('skips duplicate ids', async () => expect(await idOf('<p id="a">واحد</p><p id="a">اثنان</p>', 'واحد')).not.toBe('p#a'))
  it('skips generated ids', async () => {
    expect(await idOf('<p id="swiper-wrapper-3c110a7105124b">واحد</p>', 'واحد')).not.toContain('3c110a')
    expect(await idOf('<p id=":r1:">واحد</p>', 'واحد')).not.toContain(':r1:')
  })
})
