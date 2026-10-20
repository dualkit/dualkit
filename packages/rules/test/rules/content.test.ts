import { describe, expect, it } from 'vitest'
import { contentRules } from '../../src/rules/content'
import { RULES } from '../../src/rules'
import { runRules } from '../../src/run'
import { coversCodePoint } from '../../src/fonts'
import { face, screen, text } from '../helpers/model'
import type { LabelNode } from '../../src/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: contentRules }).map((f) => f.rule)

describe('content rules', () => {
  it('passes a tagged Arabic page', () => {
    expect(ids(screen({ texts: [text()] }))).toEqual([])
  })
  it('flags a page with no lang', () => {
    expect(ids(screen({ root: { lang: null, dir: 'rtl', computedDir: 'rtl' } }))).toEqual(['content/missing-lang'])
  })
  it('flags an Arabic page with no dir="rtl"', () => {
    expect(ids(screen({ root: { lang: 'ar', dir: null, computedDir: 'ltr' }, texts: [text()] }))).toEqual(['content/missing-dir'])
  })
  it.each(['RTL', 'Rtl', 'auto', 'AUTO'])('accepts dir="%s" on an Arabic page when the page runs right to left', (dir) => {
    expect(ids(screen({ root: { lang: 'ar', dir, computedDir: 'rtl' }, texts: [text()] }))).toEqual([])
  })
  it.each([
    [null, 'The page runs left to right because <html> has no dir="rtl", but 100% of the text is Arabic.'],
    ['ltr', 'The page runs left to right because <html> has no dir="rtl", but 100% of the text is Arabic.'],
    ['auto', 'The page runs left to right because dir="auto" took the direction of a leading Latin word, but 100% of the text is Arabic.'],
    ['rtl', 'The page runs left to right because the body or a stylesheet sets it back, but 100% of the text is Arabic.'],
  ])('says why a page with dir=%s runs left to right', (dir, message) => {
    const found = runRules(screen({ root: { lang: 'ar', dir, computedDir: 'ltr' }, texts: [text()] }), { rules: contentRules })
    expect(found.map((f) => f.message)).toEqual([message])
  })
  it('flags dir="ltr" on an Arabic page', () => {
    expect(ids(screen({ root: { lang: 'ar', dir: 'ltr', computedDir: 'ltr' }, texts: [text()] }))).toEqual(['content/missing-dir'])
  })
  it('flags Arabic text tagged as another language', () => {
    expect(ids(screen({ texts: [text({ lang: 'en' })] }))).toEqual(['content/lang-mismatch'])
  })
  it('flags the minority digit system when both appear in Arabic', () => {
    const out = runRules(screen({ texts: [text({ text: 'المبلغ 50', blockText: 'المبلغ 50' }), text({ text: 'المبلغ 60', blockText: 'المبلغ 60' }), text({ text: 'المبلغ ٥٠', blockText: 'المبلغ ٥٠' })] }), { rules: contentRules })
    expect(out.map((f) => f.rule)).toEqual(['content/mixed-digits'])
    expect(out[0]?.message).toContain('٥٠')
  })
  it('accepts Arabic-script language tags as Arabic', () => {
    expect(ids(screen({ texts: [text({ lang: 'fa' })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ lang: 'ar-AE' })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ lang: 'FA-ir' })] }))).toEqual([])
  })
  it('still flags Arabic tagged with a non-Arabic-script language, including look-alike subtags', () => {
    expect(ids(screen({ texts: [text({ lang: 'en' })] }))).toEqual(['content/lang-mismatch'])
    expect(ids(screen({ texts: [text({ lang: 'art' })] }))).toEqual(['content/lang-mismatch'])
  })
  it('does not flag lang-mismatch when the run has no lang at all (missing-lang covers it)', () => {
    expect(ids(screen({ texts: [text({ lang: null })] }))).toEqual([])
  })
  it('flags placeholder text', () => {
    expect(ids(screen({ texts: [text({ text: 'لوريم إيبسوم دولور' })] }))).toEqual(['content/placeholder-text'])
  })
})

const run = (m: Parameters<typeof runRules>[0], id: string) => runRules(m, { rules: contentRules.filter((r) => r.id === id) })
const label = (p: Partial<LabelNode> = {}): LabelNode => ({ id: 'b', snippet: '<button>', box: { x: 0, y: 0, width: 10, height: 10 }, attr: 'aria-label', text: 'إغلاق', lang: 'ar', ...p })

describe('coversCodePoint', () => {
  it.each([
    ['U+20C0-20CF', 0x20c1, true], ['U+20C?', 0x20c3, true], ['U+20C?', 0x20d0, false], ['U+0600-06FF, U+20C1', 0x20c1, true],
    ['U+20C1', 0x20c3, false], ['U+20c4', 0x20c4, true], ['U+0-10FFFF', 0x20c1, false], ['nonsense', 0x20c1, false],
  ])('range %s at %i is %s', (unicodeRange, cp, want) => expect(coversCodePoint(face({ unicodeRange }), cp)).toBe(want))
})

describe('content/old-rial-sign', () => {
  const id = 'content/old-rial-sign'
  it('flags U+FDFC with the exact copy', () => {
    // dualkit-disable-next-line source/old-rial-sign -- test input for content/old-rial-sign
    const out = run(screen({ texts: [text({ text: '١٠٠ ﷼' })] }), id)
    // dualkit-disable-next-line source/old-rial-sign -- asserts the check message
    expect(out.map((f) => f.message)).toEqual(['﷼ is the rial ligature, not the Saudi riyal sign.'])
    expect(out[0]?.fix).toBe('Use ⃁ (U+20C1) for the Saudi riyal with a font that has it, or write ر.س or SAR.')
    expect(out[0]?.severity).toBe('warning')
  })
  it('stays quiet on ر.س and on SAR', () => {
    expect(run(screen({ texts: [text({ text: '١٠٠ ر.س' }), text({ text: '100 SAR' })] }), id)).toEqual([])
  })
})

describe('content/currency-sign-font', () => {
  const id = 'content/currency-sign-font'
  const sign = (cp: string) => screen({ texts: [text({ text: `${cp} 100` })], fonts: [face({ unicodeRange: 'U+0-10FFFF' })] })
  it.each(['\u20C1', '\u20C3', '\u20C4'])('flags U+%s when only a default-range face is loaded', (cp) => {
    expect(run(sign(cp), id).map((f) => f.rule)).toEqual([id])
  })
  it('flags it when the covering face has not loaded', () => {
    const m = screen({ texts: [text({ text: '\u20C1 100' })], fonts: [face({ unicodeRange: 'U+20C0-20CF', status: 'error' })] })
    expect(run(m, id)).toHaveLength(1)
  })
  it('flags it when the covering face is not in the run\'s family stack', () => {
    const m = screen({ texts: [text({ text: '\u20C1 100' })], fonts: [face({ family: 'Other', unicodeRange: 'U+20C0-20CF' })] })
    expect(run(m, id)).toHaveLength(1)
  })
  it('stays quiet when a loaded face in the stack declares the code point', () => {
    for (const unicodeRange of ['U+20C0-20CF', 'U+20C?', 'U+0600-06FF, U+20C1']) {
      expect(run(screen({ texts: [text({ text: '\u20C1 100' })], fonts: [face({ unicodeRange })] }), id), unicodeRange).toEqual([])
    }
  })
  it('stays quiet when the reader measured the webfont drawing the sign, whatever its unicode-range', () => {
    const m = screen({ texts: [text({ text: '\u20C1 100', signs: [{ codePoint: 0x20c1, drawnByWebfont: true }] })] })
    expect(run(m, id)).toEqual([])
  })
  it('judges each sign on its own', () => {
    const t = text({ text: '\u20C1 \u20C3', signs: [{ codePoint: 0x20c1, drawnByWebfont: true }, { codePoint: 0x20c3, drawnByWebfont: false }] })
    expect(run(screen({ texts: [t] }), id).map((f) => f.message)).toEqual([expect.stringContaining('U+20C3')])
  })
  it('stays quiet on a page with no new currency sign', () => {
    expect(run(screen({ texts: [text({ text: '100 ر.س' })] }), id)).toEqual([])
  })
})

describe('content/dirham-sign-with-code', () => {
  const id = 'content/dirham-sign-with-code'
  it.each(['\u20C3 500 AED', 'AED \u20C3500', '\u20C3500 aed', '\u20C3 500 Aed.'])('flags %s as a note', (t) => {
    const out = run(screen({ texts: [text({ text: t })] }), id)
    expect(out.map((f) => f.rule)).toEqual([id])
    expect(out[0]?.severity).toBe('note')
  })
  it('stays quiet on the sign alone, the code alone, Dh and the Arabic word', () => {
    const texts = ['\u20C3 500', '500 AED', '\u20C3 500 Dh', '\u20C3 500 درهم', '\u20C3 500 PAED', '\u20C3 500 AEDS'].map((t) => text({ text: t }))
    expect(run(screen({ texts }), id)).toEqual([])
  })
  it('stays quiet when the sign and the code are in different runs', () => {
    expect(run(screen({ texts: [text({ text: '\u20C3 500' }), text({ text: 'AED' })] }), id)).toEqual([])
  })
})

describe('content/label-language', () => {
  const id = 'content/label-language'
  it('flags a Latin sentence read as Arabic, as a note', () => {
    const out = run(screen({ labels: [label({ text: 'Close the dialog' })] }), id)
    expect(out.map((f) => f.rule)).toEqual([id])
    expect(out[0]?.severity).toBe('note')
  })
  it('flags an Arabic sentence read as English', () => {
    expect(run(screen({ labels: [label({ text: 'إغلاق النافذة', lang: 'en' })] }), id)).toHaveLength(1)
    expect(run(screen({ labels: [label({ text: 'إغلاق النافذة', lang: 'en-GB', attr: 'alt' })] }), id)).toHaveLength(1)
  })
  it('stays quiet on one-word brand names, matching labels, mixed labels and unknown language', () => {
    const labels = [
      label({ text: 'Dualkit' }), label({ text: 'Visa', attr: 'alt' }), label({ text: 'إغلاق النافذة' }),
      label({ text: 'Close the dialog', lang: 'en' }), label({ text: 'ادفع عبر Apple Pay' }), label({ text: 'Close the dialog', lang: null }),
      label({ text: 'إغلاق', lang: 'en' }),
    ]
    expect(run(screen({ labels }), id)).toEqual([])
  })
})

describe('RULES', () => {
  it('ships twenty-nine rules with unique ids, in five groups', () => {
    expect(RULES).toHaveLength(29)
    expect(new Set(RULES.map((r) => r.id)).size).toBe(29)
    expect(new Set(RULES.map((r) => r.group))).toEqual(new Set(['bidi', 'layout', 'icons', 'type', 'content']))
  })
  it('gives every rule a why and a fix with no em dash', () => {
    for (const r of RULES) {
      expect(r.why.length, r.id).toBeGreaterThan(20)
      expect(r.fix.length, r.id).toBeGreaterThan(10)
      expect(`${r.title}${r.why}${r.fix}`, r.id).not.toMatch(/—/)
    }
  })
})
