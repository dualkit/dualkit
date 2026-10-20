// Final review I2: a loaded webfont with the default unicode-range and a brand name (GE SS Two, HelveticaNeueW23)
// counts as Arabic when the page measures it drawing alef. A Latin-only face under the same kind of name does not.
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { closeBrowser, modelOf, readerSource, withPage } from './helpers/browser'

afterAll(closeBrowser)

const b64 = (file: string) => readFileSync(new URL(`./fonts/${file}`, import.meta.url)).toString('base64')
const PLEX = `url(data:font/woff2;base64,${b64('IBMPlexSansArabic-Regular.woff2')}) format("woff2")`
const SIGNS = `url(data:font/woff;base64,${b64('CurrencySigns.woff')}) format("woff")`
const doc = (family: string, src: string, extra = '') =>
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@font-face{font-family:"${family}";src:${src}${extra}}body{font-family:"${family}",sans-serif}</style></head><body><p>مرحبا بكم في البنك</p></body></html>`
const fontRule = async (html: string) => runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === 'type/arabic-font') }).map((f) => f.message)

describe('type/arabic-font measures a loaded face whose name says nothing', () => {
  it.each(['Brand Sans', 'GE SS Two', 'HelveticaNeueW23'])('Plex Arabic loaded as "%s" draws Arabic and passes', async (family) => {
    const m = await modelOf(doc(family, PLEX))
    expect(m.fonts.map((f) => [f.family, f.status, f.drawsArabic])).toEqual([[family, 'loaded', true]])
    expect(await fontRule(doc(family, PLEX))).toEqual([])
  })
  it('a Latin-only face loaded as "Brand Sans" does not draw Arabic and fails', async () => {
    const m = await modelOf(doc('Brand Sans', SIGNS))
    expect(m.fonts.map((f) => [f.status, f.drawsArabic])).toEqual([['loaded', false]])
    expect(await fontRule(doc('Brand Sans', SIGNS))).toEqual(['Arabic falls back from Brand Sans, sans-serif.'])
  })
  it('does not measure a face the name already vouches for, one with an explicit range, or one that is not loaded', async () => {
    const m = await modelOf(doc('IBM Plex Sans Arabic', PLEX))
    expect(m.fonts.map((f) => f.drawsArabic)).toEqual([null])
    expect((await modelOf(doc('Brand Sans', PLEX, ';unicode-range:U+0600-06FF'))).fonts.map((f) => f.drawsArabic)).toEqual([null])
    expect((await modelOf(doc('Brand Sans', 'url(data:font/woff2;base64,AAAA) format("woff2")'))).fonts.map((f) => [f.status, f.drawsArabic])).toEqual([['error', null]])
  })
  it('removes its probe and does not throw on an odd family name', async () => {
    const odd = '"Odd, \\"Name\'s"'
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@font-face{font-family:${odd};src:${PLEX}}body{font-family:${odd},sans-serif}</style></head><body><p>مرحبا</p></body></html>`
    const children = await withPage(html, async (p) => {
      await p.evaluate(() => document.fonts.ready)
      await p.addScriptTag({ content: await readerSource() })
      const fonts = await p.evaluate(() => (globalThis as unknown as { dualkitReader: { readScreen: (d: Document) => { fonts: unknown[] } } }).dualkitReader.readScreen(document).fonts)
      return { fonts: fonts.length, children: await p.evaluate(() => document.body.children.length) }
    })
    expect(children).toEqual({ fonts: 1, children: 1 })
  })
})
