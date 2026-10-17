// Probes for the "costs if wrong" rulings. Ground truth is what Chromium paints, measured per character.
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf, withPage } from './helpers/browser'
import { charBoxes, markEdge } from './helpers/visual'

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

  it('still accepts dir="rtl" on <body> alone', async () => {
    const html = page('<p>مرحبا بكم في المتجر</p>', { lang: 'ar', dir: null }).replace('<body>', '<body dir="rtl">')
    expect(await found(html, 'content/missing-dir')).toEqual([])
  })
})
