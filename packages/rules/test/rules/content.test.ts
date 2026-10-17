import { describe, expect, it } from 'vitest'
import { contentRules } from '../../src/rules/content'
import { RULES } from '../../src/rules'
import { runRules } from '../../src/run'
import { screen, text } from '../helpers/model'

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
  it('flags dir="auto" that resolves left to right, and says so', () => {
    const found = runRules(screen({ root: { lang: 'ar', dir: 'auto', computedDir: 'ltr' }, texts: [text()] }), { rules: contentRules })
    expect(found.map((f) => f.rule)).toEqual(['content/missing-dir'])
    expect(found[0]!.message).toBe('100% of the text is Arabic, but dir="auto" resolves to left to right.')
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

describe('RULES', () => {
  it('ships twenty rules with unique ids, in five groups', () => {
    expect(RULES).toHaveLength(20)
    expect(new Set(RULES.map((r) => r.id)).size).toBe(20)
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
