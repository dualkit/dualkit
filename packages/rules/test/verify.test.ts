// Probes for the "costs if wrong" rulings. Ground truth is what Chromium paints, measured per character.
import { readFileSync } from 'node:fs'
import type { Page } from 'playwright'
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf, readerSource, withPage } from './helpers/browser'
import { charBoxes, inkExtent, markEdge, visualText } from './helpers/visual'

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

// Task 4 probes: which blind spots in the bidi rules Chromium paints a difference for.
describe('bidi/unisolated-number and three groups of Arabic-Indic digits', () => {
  const digits = (html: string) => withPage(html, async (p) => visualText(await charBoxes(p, '#n')).replace(/[^\u0660-\u0669]/g, ''))
  it('paints رقم ٠٥٠ ١٢٣ ٤٥٦٧ identically with and without <bdi>, so the rule leaves it alone', async () => {
    const AI = '\u0660\u0665\u0660 \u0661\u0662\u0663 \u0664\u0665\u0666\u0667'
    const bare = await digits(page(`<p id="n">رقم ${AI}</p>`))
    const isolated = await digits(page(`<p id="n">رقم <bdi>${AI}</bdi></p>`))
    expect(bare).toBe('\u0664\u0665\u0666\u0667\u0661\u0662\u0663\u0660\u0665\u0660')
    expect(isolated).toBe(bare)
    expect(await found(page(`<p>رقم ${AI}</p>`), 'bidi/unisolated-number')).toEqual([])
  })
})

// Every shape the Latin rule knows, in every position the fix round asked for, painted bare and inside <bdi>.
// The rule must fire exactly where isolation changes the paint and a scramble (not a Latin neighbour joining) is the cause.
const SHAPES = [
  'hi@example.com', 'user.name+tag@mail.co.uk', 'https://example.com/a/b', 'https://example.com/a/b/', 'www.example.com',
  'ORDER-2041', 'INV_2041', '#A-10293', '#A10293', '#FFF', '#iPhone',
]
// `scrambles` is whether isolation changes the paint for a trailing-slash-free, #-free token in that position.
const POSITIONS: Array<{ name: string; ctx: string; scrambles: boolean; latinJoin?: boolean }> = [
  { name: 'between Arabic words', ctx: 'رقم {} تم', scrambles: false },
  { name: 'at the end', ctx: 'اكتب إلى {}', scrambles: false },
  { name: 'at the end before an Arabic full stop', ctx: 'اكتب إلى {}\u06D4', scrambles: false },
  { name: 'at the end before an Arabic question mark', ctx: 'اكتب إلى {}\u061F', scrambles: false },
  { name: 'at the start of the block', ctx: '{} تم الطلب', scrambles: false },
  { name: 'alone in the block', ctx: '{}', scrambles: false },
  { name: 'before a Latin full stop', ctx: 'تم {}. ثم', scrambles: false },
  { name: 'inside brackets', ctx: 'تم ({}) ثم', scrambles: false },
  { name: 'before a Latin closing bracket', ctx: 'تم {}) ثم', scrambles: false },
  { name: 'before a Latin comma', ctx: 'تم {}, ثم', scrambles: false },
  { name: 'before an Arabic comma', ctx: 'تم {}\u060C ثم', scrambles: false },
  { name: 'before an Arabic number', ctx: 'تم {} \u0665', scrambles: false },
  { name: 'after a Western digit group with a space', ctx: 'تم 5 {}', scrambles: false },
  { name: 'before a Western digit after a space', ctx: 'تم {} 5', scrambles: true },
  { name: 'before a Western digit after a dash', ctx: 'تم {} - 5', scrambles: true },
  { name: 'before a Western digit after a comma', ctx: 'تم {}\u060C 5', scrambles: true },
  { name: 'before an Extended Arabic-Indic digit', ctx: 'تم {} \u06F5', scrambles: true },
  { name: 'directly after a Western digit', ctx: 'تم 5{}', scrambles: true },
  { name: 'directly after an Arabic-Indic digit', ctx: 'تم \u0665{}', scrambles: true },
  { name: 'before a Western digit with an Arabic word between', ctx: 'تم {} ثم 5', scrambles: false },
  { name: 'before a Latin word', ctx: 'تم {} Apple', scrambles: false, latinJoin: true },
  { name: 'after a Latin word', ctx: 'Apple {} تم', scrambles: false, latinJoin: true },
]
const hasEdgeMark = (shape: string) => shape.startsWith('#') || shape.endsWith('/')

describe('bidi/unisolated-latin: only the shapes and positions that Chromium paints differently', () => {
  const paint = (html: string) => withPage(html, async (p) => visualText(await charBoxes(p, '#n')))
  const html = (ctx: string, shape: string, isolate: boolean) => page(`<p id="n">${ctx.replace('{}', isolate ? `<bdi>${shape}</bdi>` : shape)}</p>`)

  it.each(SHAPES)('%s: the rule fires exactly where isolation scrambles it', async (shape) => {
    for (const { name, ctx, scrambles, latinJoin } of POSITIONS) {
      const differs = (await paint(html(ctx, shape, false))) !== (await paint(html(ctx, shape, true)))
      if (!latinJoin) expect(differs, `${shape} ${name}: paint`).toBe(hasEdgeMark(shape) || scrambles)
      const fires = (await found(html(ctx, shape, false), 'bidi/unisolated-latin')).length > 0
      expect(fires, `${shape} ${name}: rule`).toBe(hasEdgeMark(shape) || scrambles)
      expect(await found(html(ctx, shape, true), 'bidi/unisolated-latin'), `${shape} ${name}: isolated`).toEqual([])
    }
  }, 60_000)

  // Dropped: a Latin neighbour. Isolation changes the order of "تم hi@example.com Apple", but only because the token
  // and Apple stop being one left-to-right phrase. The bare paint reads token then Apple, in order, so it is not a scramble.
  it('does not treat a token that joins a neighbouring Latin word as scrambled', async () => {
    const bare = await paint(html('تم {} Apple', 'hi@example.com', false))
    expect(bare.indexOf('h')).toBeLessThan(bare.indexOf('A'))
    expect(await found(html('تم {} Apple', 'hi@example.com', false), 'bidi/unisolated-latin')).toEqual([])
  })

  it('does not fire on a trailing full stop after a link, which is the sentence\'s own mark', async () => {
    expect(await found(page('<p>زر https://example.com/a/b. ثم</p>'), 'bidi/unisolated-latin')).toEqual([])
  })

  it('still reads the surroundings when the token sits in its own element', async () => {
    expect(await found(page('<p>تم <a href="#">hi@example.com</a> 5</p>'), 'bidi/unisolated-latin')).toEqual(['bidi/unisolated-latin'])
    expect(await found(page('<p>تم <a href="#">hi@example.com</a> ثم</p>'), 'bidi/unisolated-latin')).toEqual([])
  })
})

describe('bidi/unisolated-number and a leading #', () => {
  const NUMBERS = ['#10293', '#12', '#\u0663\u0664\u0665', '#\u06F5']
  const POS = [
    { name: 'after Arabic text', ctx: 'رقم الطلب {} تم', differs: true },
    { name: 'at the end after Arabic', ctx: 'الطلب رقم {}', differs: true },
    { name: 'in brackets after Arabic', ctx: 'الطلب ({}) تم', differs: true },
    { name: 'after a Latin word', ctx: 'Order {} تم', differs: true, latinJoin: true },
    { name: 'at the start of the block', ctx: '{} تم الطلب', differs: false },
    { name: 'alone in the block', ctx: '{}', differs: false },
    { name: 'after a Western digit', ctx: '5 {} تم', differs: false },
    { name: 'in brackets with nothing before', ctx: '({}) تم', differs: false },
    { name: 'in quotes with nothing before', ctx: '"{}" تم', differs: false },
    { name: 'after a full stop with nothing else before', ctx: '. {} تم', differs: false },
    { name: 'after Arabic and a Western digit', ctx: 'رقم 5 {}', differs: true },
    { name: 'after Arabic and an Arabic-Indic digit', ctx: 'رقم \u0665 {} تم', differs: true },
    { name: 'after Arabic and a full stop', ctx: 'رقم. {} تم', differs: true },
  ]
  const paint = (h: string) => withPage(h, async (p) => visualText(await charBoxes(p, '#n')))
  const h = (ctx: string, n: string, bdi: boolean) => page(`<p id="n">${ctx.replace('{}', bdi ? `<bdi>${n}</bdi>` : n)}</p>`)

  it.each(NUMBERS)('%s: the rule fires where isolation changes the paint after Arabic', async (n) => {
    const arabicIndic = /[\u0660-\u0669]/.test(n)
    for (const { name, ctx, differs, latinJoin } of POS) {
      const real = (await paint(h(ctx, n, false))) !== (await paint(h(ctx, n, true)))
      // Arabic-Indic digits are never joined to the #, so they scramble even at the start; Western ones need a letter before.
      expect(real, `${n} ${name}: paint`).toBe(arabicIndic || differs)
      const fires = (await found(h(ctx, n, false), 'bidi/unisolated-number')).length > 0
      expect(fires, `${n} ${name}: rule`).toBe(arabicIndic ? real : differs && !latinJoin)
      expect(await found(h(ctx, n, true), 'bidi/unisolated-number'), `${n} ${name}: isolated`).toEqual([])
    }
  }, 60_000)

  it('leaves a lone #, a colour such as #FFF and an isolated number alone, and does not double-fire', async () => {
    const both = async (body: string) => {
      const m = await modelOf(page(`<p>${body}</p>`))
      return runRules(m, { rules: RULES.filter((r) => r.id === 'bidi/unisolated-number' || r.id === 'bidi/unisolated-latin') }).map((f) => f.rule)
    }
    expect(await both('اللون # تم')).toEqual([])
    expect(await both('اللون #FFF تم')).toEqual(['bidi/unisolated-latin'])
    expect(await both('رقم الطلب #10293 تم')).toEqual(['bidi/unisolated-number'])
    expect(await both('رقم الطلب <bdi>#10293</bdi> تم')).toEqual([])
  })
})

describe('bidi/punctuation-flip beyond the last run', () => {
  const SHAPES: Array<{ name: string; body: string; dir: Dir; reads: Dir }> = [
    { name: 'English line before a <br> in an rtl block', body: 'Hello world!<br>مرحبا بكم', dir: 'rtl', reads: 'ltr' },
    { name: 'English line in <b> before a <br> in an rtl block', body: '<b>Hello world!</b><br>مرحبا بكم', dir: 'rtl', reads: 'ltr' },
    { name: 'Arabic line before a <br> in an ltr block', body: 'مرحبا بكم في المتجر.<br>Hello there', dir: 'ltr', reads: 'rtl' },
    { name: 'Arabic line before a <br> in an rtl block', body: 'مرحبا بكم في المتجر.<br>Hello there', dir: 'rtl', reads: 'rtl' },
    { name: 'English line before a <br> in an ltr block', body: 'Hello world!<br>مرحبا بكم', dir: 'ltr', reads: 'ltr' },
  ]
  it.each(SHAPES)('$name: the rule reports exactly when the mark lands at the line start', async ({ body, dir, reads }) => {
    const html = page(`<p id="n">${body}</p>`, { lang: dir === 'rtl' ? 'ar' : 'en', dir })
    // The mark is the last typed character of the first line, which charBoxes returns in typed order.
    const edge = await withPage(html, async (p) => {
      const all = (await charBoxes(p, '#n')).filter((b) => b.ch.trim() !== '' && b.right > b.left)
      const line = all.filter((b) => b.top === all[0]!.top)
      return markEdge(line)
    })
    const flipped = edge === (reads === 'ltr' ? 'left' : 'right')
    expect(edge).toBe(dir === 'rtl' ? 'left' : 'right')
    expect((await found(html, 'bidi/punctuation-flip')).length > 0).toBe(flipped)
  })

  it('leaves a line alone when an Arabic-majority line merely ends in an English tag before the <br>', async () => {
    const html = page('<p id="n">مرحبا بكم في المتجر <b>Pro.</b><br>سطر ثان</p>')
    const edge = await withPage(html, async (p) => {
      const all = (await charBoxes(p, '#n')).filter((b) => b.ch.trim() !== '' && b.right > b.left)
      return markEdge(all.filter((b) => b.top === all[0]!.top))
    })
    expect(edge).toBe('left')
    expect(await found(html, 'bidi/punctuation-flip')).toEqual([])
  })

  it('does not move a closing parenthesis inside an inline run: السعر (AED) <b>١٠٠</b> paints correctly', async () => {
    const html = page('<p id="n">السعر (AED) <b>١٠٠</b></p>')
    const v = await withPage(html, async (p) => visualText(await charBoxes(p, '#n')))
    expect(v.indexOf(')')).toBeLessThan(v.indexOf('A'))
    expect(v.indexOf('(')).toBeGreaterThan(v.indexOf('D'))
    expect(await found(html, 'bidi/punctuation-flip')).toEqual([])
  })

  // Dropped: a mark ending an inline run in the middle of a line. It flips only when the next text runs the
  // paragraph's way, which is the ordinary behaviour of any Latin phrase followed by Arabic, tagged or not.
  it('paints "!" at the start of an English phrase followed by Arabic, tagged or not, and the rule leaves both alone', async () => {
    for (const body of ['<b>Hello world!</b> مرحبا', 'Hello world! مرحبا']) {
      const html = page(`<p id="n">${body}</p>`)
      const v = await withPage(html, async (p) => visualText(await charBoxes(p, '#n')))
      expect(v.indexOf('!')).toBeLessThan(v.indexOf('H'))
      expect(await found(html, 'bidi/punctuation-flip')).toEqual([])
    }
  })
})

describe('bidi/field-placeholder: an Arabic placeholder in a left-to-right field', () => {
  const HINT = 'البريد الإلكتروني'
  const CSS = 'input{width:300px;border:0;padding:0;background:#fff;color:#000;font:16px "IBM Plex Sans Arabic"}::placeholder{color:#000;opacity:1}'
  const input = (attrs: string, css = '') => page(`<input id="n" ${attrs} placeholder="${HINT}">`, { css: CSS + css })
  const FIX = 'input:placeholder-shown{direction:rtl}'
  const ink = (html: string) => withPage(html, (p) => inkExtent(p, '#n'))

  it('paints the placeholder flush left in an ltr email field and flush right in an rtl one', async () => {
    const ltr = await ink(input('type="email" dir="ltr"'))
    expect(ltr.left).toBeLessThan(0.05)
    expect(ltr.right).toBeLessThan(0.5)
    const rtl = await ink(input('type="text"'))
    expect(rtl.right).toBeGreaterThan(0.95)
    expect(rtl.left).toBeGreaterThan(0.5)
  })

  it('paints it flush left in a tel field, which Chromium lays out ltr on its own', async () => {
    const tel = await ink(input('type="tel"'))
    expect(tel.left).toBeLessThan(0.05)
  })

  it('input:placeholder-shown { direction: rtl } puts the hint flush right and leaves the typed value ltr', async () => {
    const html = input('type="email" dir="ltr"', FIX)
    const hint = await ink(html)
    expect(hint.right).toBeGreaterThan(0.95)
    expect(hint.left).toBeGreaterThan(0.5)
    const dirs = await withPage(html, async (p) => {
      const direction = () => p.evaluate(() => getComputedStyle(document.querySelector('#n')!).direction)
      const empty = await direction()
      await p.fill('#n', 'sara@example.com')
      return { empty, typed: await direction() }
    })
    expect(dirs).toEqual({ empty: 'rtl', typed: 'ltr' })
    const typed = await ink(page(`<input id="n" type="email" dir="ltr" value="sara@example.com" placeholder="${HINT}">`, { css: CSS + FIX }))
    expect(typed.left).toBeLessThan(0.05)
  })

  it('flags the ltr field, and stays quiet for a Latin hint, an rtl text field and the fixed field', async () => {
    expect(await found(input('type="email" dir="ltr"'), 'bidi/field-placeholder')).toEqual(['bidi/field-placeholder'])
    expect(await found(input('type="tel"'), 'bidi/field-placeholder')).toEqual(['bidi/field-placeholder'])
    expect(await found(page('<input type="email" dir="ltr" placeholder="name@example.com">'), 'bidi/field-placeholder')).toEqual([])
    expect(await found(input('type="text"'), 'bidi/field-placeholder')).toEqual([])
  })

  // Final review I3: the reader records where the hint lands, from the field's text-align and the ::placeholder's.
  it.each([
    ['text-align:right on the field', 'type="tel" dir="ltr" style="text-align:right"', ''],
    ['::placeholder { text-align: right }', 'type="email" dir="ltr"', '::placeholder{text-align:right}'],
    ['::placeholder { text-align: end }', 'type="email" dir="ltr"', '::placeholder{text-align:end}'],
  ])('paints the hint flush right and stays quiet with %s', async (name, attrs, css) => {
    const html = input(attrs, css)
    const hint = await ink(html)
    console.info(`placeholder: ${name}: ink ${hint.left.toFixed(3)}..${hint.right.toFixed(3)} of the 300px field`)
    expect(hint.right).toBeGreaterThan(0.95)
    expect(hint.left).toBeGreaterThan(0.5)
    expect((await modelOf(html)).fields[0]?.placeholderSide).toBe('right')
    expect(await found(html, 'bidi/field-placeholder')).toEqual([])
  })
  it('still fires with ::placeholder { text-align: start } in a left-to-right field', async () => {
    const html = input('type="email" dir="ltr"', '::placeholder{text-align:start}')
    expect((await ink(html)).left).toBeLessThan(0.05)
    expect((await modelOf(html)).fields[0]?.placeholderSide).toBe('left')
    expect(await found(html, 'bidi/field-placeholder')).toEqual(['bidi/field-placeholder'])
  })

  it('stays quiet once the hint is fixed with :placeholder-shown, and while a typed value hides the hint', async () => {
    expect(await found(input('type="email" dir="ltr"', FIX), 'bidi/field-placeholder')).toEqual([])
    const prefilled = page(`<input type="email" dir="ltr" value="sara@example.com" placeholder="${HINT}">`)
    expect(await found(prefilled, 'bidi/field-placeholder')).toEqual([])
  })
})

// R-currency: does the fixture face (IBM Plex Sans Arabic, default unicode-range) really draw the new currency signs?
describe('currency signs in IBM Plex Sans Arabic', () => {
  const draw = (cp: string, family: string) =>
    withPage(page(`<p><span id="s" style="font-size:48px;font-family:${family}">${cp}</span></p>`), async (p) => {
      await p.evaluate(() => document.fonts.ready)
      const width = await p.evaluate(() => document.querySelector('#s')!.getBoundingClientRect().width)
      const png = (await p.locator('#s').screenshot()).toString('base64')
      return { width, png }
    })
  const PLEX = '"IBM Plex Sans Arabic",sans-serif'

  it('draws U+20C3 and U+20C4 as the face\'s own missing-glyph box, and U+20C1 from a system font, never from the face', async () => {
    const alef = await draw('\u0627', PLEX)
    // Control: the face does draw Arabic, and differently from the system font.
    expect(alef.width).not.toBe((await draw('\u0627', 'sans-serif')).width)
    const unassigned = (await draw('\u0378', PLEX)).width
    // U+0378 is unassigned, so its advance is the face's .notdef box (22.66px at 48px).
    for (const cp of ['\u20C3', '\u20C4']) expect((await draw(cp, PLEX)).width).toBe(unassigned)
    // U+20C1 is 25.86px: not the face's box, and exactly what a stack without the face paints, so a system font drew it.
    // That depends on the visitor's OS (this machine has one), which is why the rule asks for a font that covers it.
    // A machine with no system font for it paints the face's box instead, so either result proves the face has no glyph.
    const riyal = (await draw('\u20C1', PLEX)).width
    expect([unassigned, (await draw('\u20C1', 'sans-serif')).width]).toContain(riyal)
  })
})

// R-currency (measured): the reader records whether the run's own webfont draws each new currency sign.
describe('content/currency-sign-font measures the webfont', () => {
  const signFace = (css = '') =>
    `@font-face{font-family:"Test Currency Signs";${css}src:url(data:font/woff;base64,${readFileSync(new URL('./fonts/CurrencySigns.woff', import.meta.url)).toString('base64')}) format("woff")}`
  const sign = (family: string, css = '') => page('<p>\u20C1 100 \u20C3</p>', { css: `${signFace()}${css}p{font-family:${family}}` })
  const signsOf = async (html: string) => (await modelOf(html)).texts.flatMap((t) => t.signs)

  it('records false for the fixture face, which lacks the signs, and the rule fires', async () => {
    const html = page('<p>\u20C1 100 \u20C3</p>')
    expect(await signsOf(html)).toEqual([{ codePoint: 0x20c1, drawnByWebfont: false }, { codePoint: 0x20c3, drawnByWebfont: false }])
    expect(await found(html, 'content/currency-sign-font')).toEqual(['content/currency-sign-font'])
  })
  it('records true for a face that has the glyphs, with no unicode-range, and the rule stays quiet', async () => {
    const html = sign('"Test Currency Signs","IBM Plex Sans Arabic",sans-serif')
    expect(await signsOf(html)).toEqual([{ codePoint: 0x20c1, drawnByWebfont: true }, { codePoint: 0x20c3, drawnByWebfont: true }])
    expect(await found(html, 'content/currency-sign-font')).toEqual([])
  })
  it('records true for U+20C4 in the glyph font and false for a declared family with no glyph', async () => {
    const html = page('<p>\u20C4</p>', { css: `${signFace()}p{font-family:"Test Currency Signs"}` })
    expect((await signsOf(html))[0]?.drawnByWebfont).toBe(true)
    const noGlyph = page('<p>\u20C3</p>', { css: '@font-face{font-family:"Empty";src:local("Arial")}p{font-family:"Empty",sans-serif}' })
    expect((await signsOf(noGlyph))[0]?.drawnByWebfont).toBe(false)
  })
  it('does not throw on a family name with a comma or a quote', async () => {
    const odd = page('<p>\u20C1 100</p>', { css: '@font-face{font-family:"Odd, \\"Name\'s";src:local("Arial")}p{font-family:"Odd, \\"Name\'s",sans-serif}' })
    const m = await modelOf(odd)
    expect(m.texts.flatMap((t) => t.signs)).toEqual([{ codePoint: 0x20c1, drawnByWebfont: false }])
  })
  it('leaves signs empty for runs without a sign and removes its probe', async () => {
    const html = page('<p>مرحبا</p>')
    const m = await modelOf(html)
    expect(m.texts.every((t) => t.signs.length === 0)).toBe(true)
    const withSign = await withPage(sign('"Test Currency Signs"'), async (p) => {
      await p.addScriptTag({ content: await readerSource() })
      await p.evaluate(() => (globalThis as unknown as { dualkitReader: { readScreen: (d: Document) => unknown } }).dualkitReader.readScreen(document))
      return p.evaluate(() => document.body.children.length)
    })
    expect(withSign).toBe(1)
  })
})

// R-mirror: text under scaleX(-1) paints as its mirror image; two flips paint it as the original.
describe('layout/mirrored-text matches what Chromium paints', () => {
  const ink = async (inner: string) => {
    const html = page(`<div style="width:300px"><div id="probe">${inner}</div></div>`)
    return withPage(html, async (p) => ({ ...(await inkExtent(p, '#probe')), png: (await p.locator('#probe').screenshot()).toString('base64') }))
  }
  const text = 'مرحبا بكم'
  const flip = (s: string) => `<div style="transform:scaleX(-1)">${s}</div>`

  it('one flip mirrors the ink about the box centre, two flips restore it', async () => {
    const plain = await ink(text)
    const once = await ink(flip(text))
    const twice = await ink(flip(flip(text)))
    expect(once.left).toBeCloseTo(1 - plain.right, 1)
    expect(once.right).toBeCloseTo(1 - plain.left, 1)
    expect(once.png).not.toBe(plain.png)
    expect(twice.left).toBeCloseTo(plain.left, 2)
    expect(twice.right).toBeCloseTo(plain.right, 2)
    console.info(`mirror: plain ink ${plain.left.toFixed(3)}..${plain.right.toFixed(3)}, one flip ${once.left.toFixed(3)}..${once.right.toFixed(3)}, two flips ${twice.left.toFixed(3)}..${twice.right.toFixed(3)} (fractions of the 300px box)`)
  })
  it('the rule fires for one flip, and stays quiet for two flips, an icon alone and a scale() flip written twice', async () => {
    expect(await found(page(`<p style="transform:scaleX(-1)">${text}</p>`), 'layout/mirrored-text')).toEqual(['layout/mirrored-text'])
    expect(await found(page(`<div style="transform:scaleX(-1)"><p style="transform:scaleX(-1)">${text}</p></div>`), 'layout/mirrored-text')).toEqual([])
    expect(await found(page(`<div style="scale:-1 1"><p style="transform:scaleX(-1)">${text}</p></div>`), 'layout/mirrored-text')).toEqual([])
    expect(await found(page('<button><svg style="transform:scaleX(-1)" width="16" height="16"><path d="M2 8h12"/></svg></button>'), 'layout/mirrored-text')).toEqual([])
  })
  it('reports once for a flipped container that holds several paragraphs', async () => {
    const html = page(`<div style="transform:scaleX(-1)"><p>${text}</p><p>${text}</p></div>`)
    expect(await found(html, 'layout/mirrored-text')).toEqual(['layout/mirrored-text'])
  })
})

// R-clip: what a fixed box cuts off, measured against the painted characters.
describe('layout/clipped-text matches what Chromium cuts off', () => {
  const label = 'اشتري الآن واحصل على خصم'
  const box = (p: Page, sel: string) => p.evaluate((s) => document.querySelector(s)!.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }, sel)

  it('an Arabic button label wider than its fixed box paints past the edge, and the rule fires', async () => {
    const html = page(`<button id="b" style="width:60px;overflow:hidden;white-space:nowrap">${label}</button>`)
    const past = await withPage(html, async (p) => {
      const b = await box(p, '#b')
      const chars = await charBoxes(p, '#b')
      return Math.max(b.left - Math.min(...chars.map((c) => c.left)), Math.max(...chars.map((c) => c.right)) - b.right)
    })
    expect(past).toBeGreaterThan(20)
    console.info(`clip x: label paints ${past.toFixed(1)}px past its 60px button`)
    expect(await found(html, 'layout/clipped-text')).toEqual(['layout/clipped-text'])
  })

  it('a one-line label at line-height 1 in a 1em box loses ink below the box, and the rule fires', async () => {
    const css = (overflow: string) => `.b{font-size:20px;line-height:1;height:1em;overflow:${overflow}}`
    const body = '<div class="b" id="b">ينبع بيت نور</div>'
    const below = async (overflow: string) =>
      withPage(page(body, { css: css(overflow) }), async (p) => {
        const { bottom } = await box(p, '#b')
        const png = (await p.screenshot({ clip: { x: 0, y: bottom - 10 - 10, width: 1024, height: 30 } })).toString('base64')
        const rows = await p.evaluate(async (b64) => {
          const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
          const c = new OffscreenCanvas(img.width, img.height)
          const ctx = c.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          const { data } = ctx.getImageData(0, 0, img.width, img.height)
          let n = 0
          for (let y = 20; y < img.height; y++) for (let x = 0; x < img.width; x++) if (data[(y * img.width + x) * 4]! < 128) n++
          return n
        }, png)
        return rows
      })
    const cut = await below('hidden')
    const free = await below('visible')
    expect(cut).toBe(0)
    expect(free).toBeGreaterThan(0)
    console.info(`clip y: dark pixels below the 1em box: ${free} with overflow visible, ${cut} with overflow hidden`)
    const html = page(body, { css: css('hidden') })
    const m = await modelOf(html)
    expect(m.clips[0]).toMatchObject({ axis: 'y' })
    expect(m.clips[0]!.hidden).toBeGreaterThan(2)
    console.info(`clip y: reader hidden = ${m.clips[0]!.hidden}px (the smaller of the scroll gap and the text reach)`)
    expect(await found(html, 'layout/clipped-text')).toEqual(['layout/clipped-text'])
  })

  it('stays quiet for an ellipsis that keeps most of the label, a scrolling container, and an .sr-only label', async () => {
    const q = (css: string, cls = 'b') => page(`<div class="${cls}">${label}</div>`, { css })
    expect(await found(q('.b{width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'), 'layout/clipped-text')).toEqual([])
    expect(await found(q('.b{width:60px;overflow:auto;white-space:nowrap}'), 'layout/clipped-text')).toEqual([])
    expect(await found(q('.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}', 'sr-only'), 'layout/clipped-text')).toEqual([])
  })

  it('flags an ellipsis that leaves under half the label showing', async () => {
    const q = page(`<div class="b">${label}</div>`, { css: '.b{width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' })
    expect(await found(q, 'layout/clipped-text')).toEqual(['layout/clipped-text'])
  })
})

// R9: a word split across inline elements. Chromium shapes a text run per element, so a boundary can cut the join.
// The word is محمد split as مح + مد: the ح joins to the following م, so a joined boundary paints ح medial and م medial,
// and a broken one paints ح final and م initial. Each case is classified against reference words set in the same style.
describe('type/arabic-broken-join matches what Chromium paints', () => {
  const widths = (html: string) => withPage(html, async (p) => (await charBoxes(p, '#w')).map((b) => Math.round((b.right - b.left) * 100) / 100))
  // Plex Bold loaded as its own family: different bytes, a real family boundary.
  const boldFamily = `@font-face{font-family:"Plex BoldFam";src:url(data:font/woff2;base64,${readFileSync(new URL('./fonts/IBMPlexSansArabic-Bold.woff2', import.meta.url)).toString('base64')}) format("woff2")}`
  // 48px: Linux CI reports whole-pixel glyph boxes, and at 16px medial and initial meem both round to 8px.
  const wrap = (inner: string) => page(`<p id="w" style="font-size:48px">${inner}</p>`, { css: boldFamily })
  const tail = (style: string) => `<span style="${style}">`
  const CASES: Array<{ name: string; style: string }> = [
    { name: 'b', style: 'font-weight:700' },
    { name: 'colour span', style: 'color:red' },
    { name: 'inline-block', style: 'display:inline-block' },
    { name: 'inline-flex', style: 'display:inline-flex' },
    { name: 'font-family (serif)', style: 'font-family:serif' },
    { name: 'font-family (Plex Bold as its own family)', style: "font-family:'Plex BoldFam'" },
    { name: 'padding-inline-start', style: 'padding-inline-start:2px' },
  ]
  it('classifies each case by the forms of the two letters at the boundary', async () => {
    const plainWord = await widths(wrap('محمد'))
    const plainFinal = (await widths(wrap('مح')))[1]!
    const outcome = new Map<string, boolean>()
    console.info(`join probe: plain محمد ${JSON.stringify(plainWord)}, ح final ${plainFinal}`)
    for (const c of CASES) {
      const open = tail(c.style)
      const styledWord = await widths(wrap(`${open}محمد</span>`))
      const styledInitial = (await widths(wrap(`${open}مد</span>`)))[0]!
      const w = await widths(wrap(`مح${open}مد</span>`))
      const hah = w[1]!
      const meem = w[2]!
      const hahJoined = Math.abs(hah - plainWord[1]!) < Math.abs(hah - plainFinal)
      const meemJoined = Math.abs(meem - styledWord[2]!) < Math.abs(meem - styledInitial)
      outcome.set(c.name, hahJoined && meemJoined)
      console.info(`join probe: ${c.name}: ح ${hah} (medial ${plainWord[1]}, final ${plainFinal}) joined=${hahJoined}; م ${meem} (medial ${styledWord[2]}, initial ${styledInitial}) joined=${meemJoined}`)
    }
    // An atomic inline box always cuts the join. A font change does not between two Plex faces; whether it does with a
    // system font depends on the platform (see the next test). The serif case cannot tell: its fallback draws the same م form everywhere.
    expect(outcome.get('inline-block')).toBe(false)
    expect(outcome.get('inline-flex')).toBe(false)
    for (const name of ['b', 'colour span', 'font-family (Plex Bold as its own family)', 'padding-inline-start']) expect(outcome.get(name)).toBe(true)
  })
  it('reports the broken cases and stays quiet for the ones that join', async () => {
    const id = 'type/arabic-broken-join'
    expect(await found(wrap('مح<span style="display:inline-block">مد</span>'), id)).toEqual([id])
    expect(await found(wrap('مح<span style="display:inline-flex">مد</span>'), id)).toEqual([id])
    for (const style of ['color:red', 'font-weight:700', "font-family:'Plex BoldFam'", 'padding-inline-start:2px']) {
      expect(await found(wrap(`مح<span style="${style}">مد</span>`), id)).toEqual([])
    }
  })
  // Reviewer's macOS probe, Chromium 140: Plex then Al Nile leaves the م initial; Geeza Pro then Plex leaves the ح final.
  // The result depends on the installed fonts, so each pair is skipped when the system font is missing.
  const systemFont = (family: string) => withPage(wrap('محمد'), async (p) =>
    p.evaluate((f) => {
      const w = (fam: string) => { const s = document.createElement('span'); s.style.cssText = `position:absolute;white-space:pre;font:32px ${fam}`; s.textContent = 'محمد'; document.body.append(s); const r = s.getBoundingClientRect().width; s.remove(); return r }
      return w(`"${f}",monospace`) !== w('monospace') || w(`"${f}",serif`) !== w('serif')
    }, family))
  it.for([
    { name: 'Geeza Pro then Plex', first: "font-family:'Geeza Pro'", second: "font-family:'IBM Plex Sans Arabic'", family: 'Geeza Pro', letter: 1 },
    { name: 'Plex then Al Nile', first: "font-family:'IBM Plex Sans Arabic'", second: "font-family:'Al Nile'", family: 'Al Nile', letter: 2 },
  ])('reports a break across a font change that paints the letters apart: $name', async ({ first, second, family, letter }, ctx) => {
    if (!(await systemFont(family))) return ctx.skip(`${family} is not installed on this machine`)
    const html = wrap(`<span style="${first}">مح</span><span style="${second}">مد</span>`)
    const model = await modelOf(html)
    const w = await widths(html)
    // The boundary letter is painted narrower or wider than the joined form: compare against each side's own references.
    const ref = async (style: string, text: string) => (await widths(wrap(`<span style="${style}">${text}</span>`)))
    const own = letter === 1 ? { medial: (await ref(first, 'محمد'))[1]!, final: (await ref(first, 'مح'))[1]! } : { medial: (await ref(second, 'محمد'))[2]!, final: (await ref(second, 'مد'))[0]! }
    const seen = w[letter]!
    console.info(`join probe: ${family}: boundary letter ${seen}, joined form ${own.medial}, split form ${own.final}`)
    expect(Math.abs(seen - own.final)).toBeLessThan(Math.abs(seen - own.medial))
    expect(model.joins).toHaveLength(1)
    expect(model.joins[0]).toMatchObject({ reason: 'font-family' })
    expect(await found(html, 'type/arabic-broken-join')).toEqual(['type/arabic-broken-join'])
  })
})
