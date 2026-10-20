// Probes for the "costs if wrong" rulings. Ground truth is what Chromium paints, measured per character.
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf, withPage } from './helpers/browser'
import { charBoxes, markEdge, visualText } from './helpers/visual'

afterAll(closeBrowser)

type Dir = 'ltr' | 'rtl'

const found = async (html: string, id: string) =>
  runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === id) }).map((f) => f.rule)

/**
 * Where the closing mark was painted, and whether that is the start of the line for the person
 * reading it. `reads` is the reader's direction: the majority script, the first word's script on
 * an even split, and nobody's for digits alone (digits read the same either way).
 */
async function measureFlip(text: string, dir: Dir, reads: Dir | null) {
  const html = page(`<p id="probe">${text}</p>`, { lang: dir === 'rtl' ? 'ar' : 'en', dir })
  const edge = await withPage(html, async (p) => markEdge(await charBoxes(p, '#probe')))
  const flipped = reads !== null && edge === (reads === 'ltr' ? 'left' : 'right')
  const reported = (await found(html, 'bidi/punctuation-flip')).length > 0
  return { edge, flipped, reported }
}

// R5: the closing mark against the paragraph direction, for every mix of scripts.
const CONTENTS: Array<{ name: string; text: string; reads: Dir | null }> = [
  { name: 'pure Arabic', text: 'مرحبا بكم في المتجر', reads: 'rtl' },
  { name: 'pure English', text: 'Welcome to the shop', reads: 'ltr' },
  { name: 'Arabic-majority, leading Latin word', text: 'iPhone هاتف رائع جدا للعمل', reads: 'rtl' },
  { name: 'Arabic-majority, trailing Latin word', text: 'هذا هاتف رائع من Apple', reads: 'rtl' },
  { name: 'English-majority, Arabic in the middle', text: 'Download the تطبيق app today', reads: 'ltr' },
  { name: 'English-majority, Arabic at the end', text: 'Welcome to our store in دبي', reads: 'ltr' },
  { name: '50/50, English first', text: 'Hello مرحبا', reads: 'ltr' },
  { name: '50/50, Arabic first', text: 'مرحبا Hello', reads: 'rtl' },
  { name: 'numbers only', text: '050 123 4567', reads: null },
]
const ENDINGS = ['.', '!', '?']
const DIRS: Dir[] = ['rtl', 'ltr']

const R5 = DIRS.flatMap((dir) => CONTENTS.flatMap((c) => ENDINGS.map((end) => ({ dir, ...c, text: c.text + end }))))

describe('R5 bidi/punctuation-flip matches where Chromium paints the closing mark', () => {
  it.each(R5)('$dir block, $name, "$text"', async ({ text, dir, reads }) => {
    const { edge, flipped, reported } = await measureFlip(text, dir, reads)
    // Every closing mark lands at the far end of its paragraph, so a flip is exactly a reader running the other way.
    expect(edge).toBe(dir === 'rtl' ? 'left' : 'right')
    expect(reported).toBe(flipped)
  })
})

// R6: Arabic closing marks. U+060C is a common separator (neutral); U+061B, U+061F and U+06D4 are strong right to left.
const ARABIC_MARKS = [
  { name: 'Arabic comma', mark: '\u060C' },
  { name: 'Arabic semicolon', mark: '\u061B' },
  { name: 'Arabic question mark', mark: '\u061F' },
  { name: 'Arabic full stop', mark: '\u06D4' },
]
// `edge` is where Chromium paints the mark: the neutral comma goes to the paragraph's far end like
// ".", while the strong marks stay with the right-to-left text they follow.
const R6 = ARABIC_MARKS.flatMap(({ name, mark }) => {
  const strong = mark !== '\u060C'
  return [
    { name, dir: 'ltr' as const, text: `مرحبا بكم في المتجر${mark}`, reads: 'rtl' as const, edge: strong ? 'left' : 'right' },
    { name, dir: 'rtl' as const, text: `Welcome to the shop${mark}`, reads: 'ltr' as const, edge: 'left' },
    { name, dir: 'rtl' as const, text: `مرحبا بكم في المتجر${mark}`, reads: 'rtl' as const, edge: 'left' },
    { name, dir: 'ltr' as const, text: `Welcome to the shop${mark}`, reads: 'ltr' as const, edge: 'right' },
  ]
})

describe('R6 Arabic punctuation at the end of a paragraph', () => {
  it.each(R6)('$name, $dir block, "$text"', async ({ text, dir, reads, edge: expected }) => {
    const { edge, flipped, reported } = await measureFlip(text, dir, reads)
    expect(edge).toBe(expected)
    expect(reported).toBe(flipped)
  })
})

// R6b: the strong Arabic marks after mixed sentences. A strong mark joins an Arabic run before it, so in an
// ltr block it stays beside Arabic; after a Latin word, or anywhere in an rtl block, it lands at the block's end.
const MIXED_ENDINGS: Array<{ name: string; text: string; reads: Dir }> = [
  { name: 'Arabic-majority, trailing Latin word', text: 'هذا هاتف رائع من Apple', reads: 'rtl' },
  { name: 'Arabic-majority, leading Latin word', text: 'iPhone هاتف رائع جدا للعمل', reads: 'rtl' },
  { name: 'English-majority, Arabic at the end', text: 'Welcome to our store in دبي', reads: 'ltr' },
  { name: 'English-majority, Arabic in the middle', text: 'Download the تطبيق app today', reads: 'ltr' },
]
/** Measured: the mark sits inside the line only when an ltr block ends in an Arabic word before a strong mark. */
const expectedEdge = (dir: Dir, text: string) => {
  const strongAfterArabic = /[\u061B\u061F\u06D4]$/.test(text) && /[\u0600-\u06FF]$/.test(text.slice(0, -1))
  if (dir === 'rtl') return 'left'
  return strongAfterArabic ? 'inside' : 'right'
}
const R6B = DIRS.flatMap((dir) => MIXED_ENDINGS.flatMap((c) => ARABIC_MARKS.map(({ name: mark, mark: ch }) => ({ dir, mark, ...c, text: c.text + ch }))))

describe('R6b Arabic marks after mixed sentences', () => {
  it.each(R6B)('$dir block, $name, $mark, "$text"', async ({ text, dir, reads }) => {
    const { edge, flipped, reported } = await measureFlip(text, dir, reads)
    expect(edge).toBe(expectedEdge(dir, text))
    expect(reported).toBe(flipped)
  })
})

// R11: block text is capped at its first and last 300 characters. Each probe puts the deciding text
// only in the middle of a block over 1,200 characters, so the cap and the full text can disagree.
const en = (n: number) => 'hello you '.repeat(n / 10)
const ar = (n: number) => 'مرحبا بكم '.repeat(n / 10)

describe('R11 rules decide from the whole block, not its capped copy', () => {
  it('layout/arabic-ltr-block flags a long LTR block that is mostly Arabic in the middle', async () => {
    const html = page(`<p>${en(200)}${ar(800)}${en(200)}</p>`, { lang: 'en', dir: 'ltr' })
    const m = await modelOf(html)
    expect(m.texts[0]!.blockText.length).toBeLessThanOrEqual(601)
    expect(m.texts[0]!.blockArabicShare).toBeGreaterThan(0.5)
    expect(m.texts[0]!.blockArabicWords).toBe(160)
    expect(await found(html, 'layout/arabic-ltr-block')).toEqual(['layout/arabic-ltr-block'])
  })

  it('layout/arabic-ltr-block stays quiet when the Arabic in the middle is a third of the block', async () => {
    const html = page(`<p>${en(400)}${ar(400)}${en(400)}</p>`, { lang: 'en', dir: 'ltr' })
    expect(await found(html, 'layout/arabic-ltr-block')).toEqual([])
  })

  it('content/mixed-digits sees two digit systems in a block whose Arabic is only in the middle', async () => {
    const html = page(`<p>${en(400)}${ar(200)}<span>السعر 50 درهم</span> ${ar(200)}<span>الكمية ٥٠ قطعة</span>${en(400)}</p>`)
    expect(await found(html, 'content/mixed-digits')).toEqual(['content/mixed-digits'])
  })

  it('content/missing-dir counts the Arabic in the middle of a long block', async () => {
    const html = page(`<p>${en(200)}${ar(800)}${en(200)}</p>`, { lang: 'ar', dir: null })
    expect(await found(html, 'content/missing-dir')).toEqual(['content/missing-dir'])
  })
})

// R20: dir="auto" on <html> takes the direction of the page's first strong character.
const AUTO_LATIN_FIRST = page('<h1>iPhone 15</h1><p>متوفر الآن في جميع فروعنا بأفضل الأسعار مع توصيل مجاني</p>', { lang: 'ar', dir: 'auto' })
const AUTO_ARABIC_FIRST = page('<h1>متوفر الآن</h1><p>iPhone 15 في جميع فروعنا بأفضل الأسعار مع توصيل مجاني</p>', { lang: 'ar', dir: 'auto' })
const rootDirection = (html: string) => withPage(html, (p) => p.evaluate(() => getComputedStyle(document.documentElement).direction))

describe('R20 content/missing-dir with dir="auto" on <html>', () => {
  it('flags an Arabic page whose auto direction resolves left to right from a leading Latin word', async () => {
    expect(await rootDirection(AUTO_LATIN_FIRST)).toBe('ltr')
    expect(await found(AUTO_LATIN_FIRST, 'content/missing-dir')).toEqual(['content/missing-dir'])
    expect((await modelOf(AUTO_LATIN_FIRST)).root.computedDir).toBe('ltr')
  })

  it('accepts dir="auto" when it resolves right to left', async () => {
    expect(await rootDirection(AUTO_ARABIC_FIRST)).toBe('rtl')
    expect((await modelOf(AUTO_ARABIC_FIRST)).root.computedDir).toBe('rtl')
    expect(await found(AUTO_ARABIC_FIRST, 'content/missing-dir')).toEqual([])
  })

  it('says the body set it back when <html dir="rtl"> has <body dir="ltr">', async () => {
    const html = page('<p>مرحبا بكم في المتجر</p>', { lang: 'ar', dir: 'rtl' }).replace('<body>', '<body dir="ltr">')
    const findings = runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === 'content/missing-dir') })
    expect(findings.map((f) => f.message)).toEqual(['The page runs left to right because the body or a stylesheet sets it back, but 100% of the text is Arabic.'])
  })

  it('still accepts dir="rtl" on <body> alone', async () => {
    const html = page('<p>مرحبا بكم في المتجر</p>', { lang: 'ar', dir: null }).replace('<body>', '<body dir="rtl">')
    expect(await found(html, 'content/missing-dir')).toEqual([])
  })
})

// R8: other languages written in Arabic script are right-to-left Arabic-script pages too.
describe('R8 Arabic-script languages', () => {
  const PERSIAN = page('<h1>فروشگاه ما</h1><p>به فروشگاه ما خوش آمدید، همه چیز با ارسال رایگان</p>', { lang: 'fa', dir: 'rtl' })
  it.each(['content/lang-mismatch', 'content/missing-dir', 'layout/arabic-ltr-block'])('a Persian page gets no %s finding', async (id) => {
    expect(await found(PERSIAN, id)).toEqual([])
  })

  it('still flags an Arabic run tagged lang="en"', async () => {
    expect(await found(page('<p lang="en">مرحبا بكم في المتجر</p>'), 'content/lang-mismatch')).toEqual(['content/lang-mismatch'])
  })
})

// X1: a lang="ar" tag does not make an Arabic paragraph right to left; only the word count marks a label.
describe('X1 layout/arabic-ltr-block on lang-tagged Arabic in an English page', () => {
  it('flags a lang="ar" section holding an Arabic paragraph with no dir', async () => {
    const html = page('<p>Welcome.</p><section lang="ar"><p>مرحبا بكم في المتجر</p></section>', { lang: 'en', dir: 'ltr' })
    expect(await found(html, 'layout/arabic-ltr-block')).toEqual(['layout/arabic-ltr-block'])
  })

  it('stays quiet on a one or two word language switcher', async () => {
    const html = page('<ul><li><a lang="ar" href="/ar">العربية</a></li><li><a lang="ar" href="/ar">مرحبا بكم</a></li></ul>', { lang: 'en', dir: 'ltr' })
    expect(await found(html, 'layout/arabic-ltr-block')).toEqual([])
  })
})

// Ruling after R17: Chromium paints Arabic-Indic groups first group on the right whether or not they are
// isolated (only <bdo> changes it), so the fix the rule gives would change nothing for them.
describe('bidi/unisolated-number and Arabic-Indic digit groups', () => {
  const order = (html: string) => withPage(html, async (p) => visualText(await charBoxes(p, '#n')).replace(/[^\u0660-\u0669]/g, ''))
  const AI = '\u0660\u0665\u0660 \u0661\u0662\u0663'
  it('Chromium paints Arabic-Indic groups the same with or without isolation', async () => {
    const bare = await order(page(`<p id="n">رقم الهاتف ${AI}</p>`))
    const isolated = await order(page(`<p id="n">رقم الهاتف <bdi dir="ltr">${AI}</bdi></p>`))
    expect(bare).toBe('\u0661\u0662\u0663\u0660\u0665\u0660')
    expect(isolated).toBe(bare)
  })

  it('does not flag groups made only of Arabic-Indic or Extended Arabic-Indic digits', async () => {
    expect(await found(page(`<p>رقم الهاتف ${AI}</p>`), 'bidi/unisolated-number')).toEqual([])
    expect(await found(page('<p>رقم الهاتف \u06F0\u06F5\u06F0 \u06F1\u06F2\u06F3</p>'), 'bidi/unisolated-number')).toEqual([])
  })

  it('still flags Western groups, a leading plus and a group mixing both systems', async () => {
    for (const n of ['050 123 4567', '+971501234567', '050 \u0661\u0662\u0663']) {
      expect(await found(page(`<p>رقم الهاتف ${n}</p>`), 'bidi/unisolated-number')).toEqual(['bidi/unisolated-number'])
    }
  })
})

// Follow-up: on a real checkout page the email field was flagged and the tel field was not.
describe('bidi/field-direction and type="tel"', () => {
  const FIELDS = '<label>البريد الإلكتروني <input type="email" value="sara@example.com"></label><label>رقم الجوال <input type="tel" value="050 123 4567"></label>'
  const dirs = (html: string) => withPage(html, (p) => p.evaluate(() => [...document.querySelectorAll('input')].map((i) => getComputedStyle(i).direction)))

  it('Chromium lays a tel input out left to right on its own, so only the email field is flagged', async () => {
    expect(await dirs(page(FIELDS))).toEqual(['rtl', 'ltr'])
    const findings = runRules(await modelOf(page(FIELDS)), { rules: RULES.filter((r) => r.id === 'bidi/field-direction') })
    expect(findings.map((f) => f.node?.id ?? '')).toEqual([expect.stringContaining('label:nth-of-type(1) > input')])
  })

  it('flags a tel input once author CSS turns it right to left', async () => {
    const html = page(FIELDS, { css: 'input{direction:inherit}' })
    expect(await dirs(html)).toEqual(['rtl', 'rtl'])
    expect(await found(html, 'bidi/field-direction')).toEqual(['bidi/field-direction', 'bidi/field-direction'])
  })
})

describe('type/arabic-font with a font-display: swap webfont', () => {
  it('reads the face as loaded after the fonts wait, so the stack passes', async () => {
    const swap = page('<p>مرحبا بكم</p>').replace(/@font-face\{/g, '@font-face{font-display:swap;')
    const model = await modelOf(swap)
    expect(model.fonts.some((f) => f.family === 'IBM Plex Sans Arabic' && f.status === 'loaded')).toBe(true)
    expect(runRules(model, { rules: RULES.filter((r) => r.id === 'type/arabic-font') })).toEqual([])
  })
  it('fails a named Arabic family with no @font-face, with the never-loaded message', async () => {
    const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>p{font-family:"IBM Plex Sans Arabic",sans-serif}</style></head><body><p>مرحبا بكم</p></body></html>'
    const out = runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === 'type/arabic-font') })
    expect(out.map((f) => f.message)).toEqual(['"IBM Plex Sans Arabic" is named but never loaded.'])
  })
  it('type/arabic-faux-bold stays quiet when the 700 face is a loaded @font-face', async () => {
    const html = page('<p>مرحبا بكم</p>', { css: 'p{font-weight:700}' })
    const model = await modelOf(html)
    expect(runRules(model, { rules: RULES.filter((r) => r.id === 'type/arabic-faux-bold') })).toEqual([])
  })
})

const fontB64 = (file: string) => readFileSync(new URL(`./fonts/${file}`, import.meta.url)).toString('base64')
const plexFace = (file: string, extra: string, family = 'P') =>
  `@font-face{font-family:"${family}";${extra};src:url(data:font/woff2;base64,${fontB64(file)}) format("woff2")}`
const REGULAR = 'IBMPlexSansArabic-Regular.woff2'
const BOLD = 'IBMPlexSansArabic-Bold.woff2'

/** Width and total ink (sum of darkness in a screenshot) of an Arabic word set in family P at the given weight. */
async function inkOf(faces: string, weight: number) {
  const html = `<!doctype html><html lang="ar" dir="rtl"><style>${faces}span{font:${weight} 40px P}</style><span id="s">مرحبا بكم في المتجر</span>`
  return withPage(html, async (p) => {
    await p.evaluate(() => document.fonts.ready)
    const width = await p.evaluate(() => document.getElementById('s')!.getBoundingClientRect().width)
    const shot = (await p.locator('#s').screenshot()).toString('base64')
    const ink = await p.evaluate(async (d) => {
      const im = new Image()
      im.src = `data:image/png;base64,${d}`
      await im.decode()
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const x = c.getContext('2d')!
      x.drawImage(im, 0, 0)
      const px = x.getImageData(0, 0, c.width, c.height).data
      let t = 0
      for (let i = 0; i < px.length; i += 4) t += 255 - px[i]!
      return t
    }, shot)
    return { width, ink }
  })
}

describe('type/arabic-faux-bold: what Chromium synthesises', () => {
  // Measured: 400 face at 400 = ink 595359, width 282.8. (i) 400 face at 700 = ink 653400, same width (smeared).
  // (ii) the 400 face declared as 600, run at 700 = ink 595359 (not synthesised). (iii) real 700 = ink 943155, width 303.3.
  it('smears a 400 face asked for 700, but not a face that claims 600', async () => {
    const base = await inkOf(plexFace(REGULAR, 'font-weight:400'), 400)
    const faux = await inkOf(plexFace(REGULAR, 'font-weight:400'), 700)
    const claims600 = await inkOf(plexFace(REGULAR, 'font-weight:600'), 700)
    const real = await inkOf(plexFace(BOLD, 'font-weight:700'), 700)
    expect(faux.width).toBeCloseTo(base.width, 1)
    expect(faux.ink).toBeGreaterThan(base.ink * 1.05)
    expect(claims600.ink).toBe(base.ink)
    expect(real.width).toBeGreaterThan(base.width * 1.05)
  })
})

describe('type/arabic-faux-bold and font reads in Chromium', () => {
  const rule = (id: string) => RULES.filter((r) => r.id === id)
  it('a 400 paragraph and a 700 heading with both fixture faces: both loaded, nothing fires', async () => {
    const html = page('<h2 style="font-weight:700">مرحبا بكم</h2><p>مرحبا بكم في المتجر</p>')
    const model = await modelOf(html)
    const plex = model.fonts.filter((f) => f.family === 'IBM Plex Sans Arabic')
    expect(plex.map((f) => f.status)).toEqual(['loaded', 'loaded'])
    expect(runRules(model, { rules: rule('type/arabic-faux-bold') })).toEqual([])
    expect(runRules(model, { rules: rule('type/arabic-font') })).toEqual([])
  })
  it('Google-Fonts-style subsets: the Arabic subset face loads and the stack passes', async () => {
    const css = plexFace(REGULAR, 'font-weight:400;unicode-range:U+0000-00FF', 'Brand') +
      plexFace(REGULAR, 'font-weight:400;unicode-range:U+0600-06FF,U+FB50-FDFF,U+FE70-FEFF', 'Brand')
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}p{font-family:Brand,sans-serif}</style></head><body><p>مرحبا بكم في المتجر</p></body></html>`
    const model = await modelOf(html)
    const arabic = model.fonts.find((f) => f.family === 'Brand' && /U\+0*600/.test(f.unicodeRange))
    expect(arabic?.status).toBe('loaded')
    expect(runRules(model, { rules: rule('type/arabic-font') })).toEqual([])
  })
})
