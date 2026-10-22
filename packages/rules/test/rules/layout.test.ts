import { describe, expect, it } from 'vitest'
import { layoutRules } from '../../src/rules/layout'
import { runRules } from '../../src/run'
import { clip, icon, layout, screen, text } from '../helpers/model'

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
  it('passes text that fills its box', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'left', textSlack: 3 })] }))).toEqual([])
    expect(ids(screen({ layouts: [layout({ textAlign: 'left', textSlack: 4 })] }))).toEqual(['layout/text-align-left'])
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

describe('layout/mirrored-text', () => {
  it('flags text under a flip, once per mirroring ancestor', () => {
    const m = screen({ texts: [text({ mirrored: true, mirroredBy: 'a', id: 'p1' }), text({ mirrored: true, mirroredBy: 'a', id: 'p2' }), text({ mirrored: true, mirroredBy: 'b', id: 'p3' })] })
    expect(ids(m)).toEqual(['layout/mirrored-text', 'layout/mirrored-text'])
  })
  it('passes text that is not mirrored overall, and a mirrored icon with no text', () => {
    expect(ids(screen({ texts: [text()], icons: [icon({ mirrored: true })] }))).toEqual([])
  })
})

describe('layout/clipped-text', () => {
  it('flags a box that cuts text off, on either axis', () => {
    expect(ids(screen({ clips: [clip({ textHidden: 40 }), clip({ axis: 'y', hidden: 5, textHidden: 5 })] }))).toEqual(['layout/clipped-text', 'layout/clipped-text'])
  })
  it('stays quiet for a clipped box with no Arabic in its text', () => {
    expect(ids(screen({ clips: [clip({ hasArabic: false })] }))).toEqual([])
  })
  it('passes a gap of 2px or less in the text, even when the scroll size overflows by more (padding)', () => {
    expect(ids(screen({ clips: [clip({ axis: 'y', hidden: 10, textHidden: 2 }), clip({ hidden: 10, textHidden: 0 })] }))).toEqual([])
    expect(ids(screen({ clips: [clip({ axis: 'y', hidden: 10, textHidden: 3 })] }))).toEqual(['layout/clipped-text'])
  })
  it('flags an ellipsis that leaves under half the text visible, and passes one that shows most of it', () => {
    expect(ids(screen({ clips: [clip({ ellipsis: true, visibleShare: 0.3 })] }))).toEqual(['layout/clipped-text'])
    expect(ids(screen({ clips: [clip({ ellipsis: true, visibleShare: 0.5 }), clip({ ellipsis: true, visibleShare: 0.9 })] }))).toEqual([])
  })
})
