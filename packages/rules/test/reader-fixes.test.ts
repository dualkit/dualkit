import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

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
