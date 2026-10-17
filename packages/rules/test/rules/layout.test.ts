import { describe, expect, it } from 'vitest'
import { layoutRules } from '../../src/rules/layout'
import { runRules } from '../../src/run'
import { layout, screen, text } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: layoutRules }).map((f) => f.rule)

describe('physical properties', () => {
  it('flags margin-left in RTL once per element', () => {
    const l = layout({ physical: [{ property: 'margin-left', value: '16px' }, { property: 'padding-right', value: '8px' }] })
    expect(ids(screen({ layouts: [l] }))).toEqual(['layout/physical-spacing'])
  })
  it('flags left, float and border sides as insets', () => {
    expect(ids(screen({ layouts: [layout({ physical: [{ property: 'left', value: '8px' }] })] }))).toEqual(['layout/physical-inset'])
  })
  it('ignores LTR elements', () => {
    expect(ids(screen({ layouts: [layout({ dir: 'ltr', physical: [{ property: 'margin-left', value: '16px' }] })] }))).toEqual([])
  })
})

describe('layout/text-align-left', () => {
  it('flags text-align left on RTL text', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'left' })] }))).toEqual(['layout/text-align-left'])
  })
  it('passes Latin text inside an RTL element', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'left', hasArabicText: false })] }))).toEqual([])
  })
  it('passes start, right, or elements without text', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'start' }), layout({ textAlign: 'right' }), layout({ textAlign: 'left', hasOwnText: false })] }))).toEqual([])
  })
})

describe('layout/arabic-ltr-block', () => {
  it('flags an Arabic paragraph laid out left to right, once per block', () => {
    const t = { text: 'مرحبا بكم', blockText: 'مرحبا بكم في المتجر', blockDir: 'ltr' as const, blockId: 'b1' }
    expect(ids(screen({ texts: [text(t), text(t)] }))).toEqual(['layout/arabic-ltr-block'])
  })
  it('passes a short Arabic label in a left-to-right page, such as a language switcher', () => {
    const label = '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'
    const two = '\u0645\u0631\u062d\u0628\u0627 \u0628\u0643\u0645'
    const m = screen({ root: { lang: 'en', dir: 'ltr', computedDir: 'ltr' }, texts: [text({ text: label, blockText: label, blockDir: 'ltr', lang: 'en' }), text({ text: two, blockText: two, blockDir: 'ltr', blockId: 'b2', lang: 'en' })] })
    expect(ids(m)).toEqual([])
  })
  it('flags a paragraph tagged with an Arabic-script lang inside a page in another language', () => {
    const t = { text: '\u0645\u0631\u062d\u0628\u0627 \u0628\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u062a\u062c\u0631', blockDir: 'ltr' as const }
    expect(ids(screen({ root: { lang: 'en', dir: 'ltr', computedDir: 'ltr' }, texts: [text({ ...t, blockText: t.text, lang: 'ar' })] }))).toEqual(['layout/arabic-ltr-block'])
    expect(ids(screen({ root: { lang: 'en', dir: 'ltr', computedDir: 'ltr' }, texts: [text({ ...t, blockText: t.text, lang: 'fa-IR' })] }))).toEqual(['layout/arabic-ltr-block'])
  })
  it('still flags an Arabic page whose own lang is ar but runs left to right', () => {
    const t = '\u0645\u0631\u062d\u0628\u0627 \u0628\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u062a\u062c\u0631'
    expect(ids(screen({ root: { lang: 'ar', dir: null, computedDir: 'ltr' }, texts: [text({ text: t, blockText: t, blockDir: 'ltr', lang: 'ar' })] }))).toEqual(['layout/arabic-ltr-block'])
  })
  it('passes mostly-English LTR blocks', () => {
    expect(ids(screen({ texts: [text({ text: 'Welcome مرحبا to the shop', blockText: 'Welcome مرحبا to the shop', blockDir: 'ltr' })] }))).toEqual([])
  })
})
