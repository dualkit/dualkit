import { describe, expect, it } from 'vitest'
import type { ScreenModel, TextRun } from '@dualkit/rules'
import { candidates } from '../../src/review/position'
import { detectFeatures } from '../../src/review/features'

const box = { x: 0, y: 0, width: 10, height: 10 }
const run = (id: string, text: string, p: Partial<TextRun> = {}): TextRun => ({
  id, snippet: `<p>${text}</p>`, box, text, blockId: 'b', blockText: text, blockArabicShare: 1, blockHasArabic: true, blockArabicWords: 2,
  blockDir: 'rtl', dir: 'rtl', lang: 'ar', isolated: false, forcedLtr: false, isLastInBlock: true, endsLine: false,
  font: { families: ['x'], size: 16, lineHeight: null, letterSpacing: 0, style: 'normal', weight: 400 }, lines: 1, signs: [], mirrored: false, mirroredBy: null, ...p,
})
export const model = (texts: TextRun[], extra: Partial<ScreenModel> = {}): ScreenModel => ({
  root: { lang: 'ar', dir: 'rtl', computedDir: 'rtl' }, texts, layouts: [], icons: [], fields: [], fonts: [], labels: [], clips: [], joins: [],
  unreadableStylesheets: 0, viewportWidth: 1280, ...extra,
})

describe('detectFeatures', () => {
  it('finds dates and money from the text runs', () => {
    const m = model([run('a', 'تاريخ التسليم 12/03/2026'), run('b', 'السعر 250 ر.س')])
    const f = detectFeatures(m, {})
    expect(f).toContain('dates')
    expect(f).toContain('money')
  })

  it('finds tables, forms and chat from tags and icons from the model', () => {
    const m = model([run('a', 'مرحبا')], { icons: [{ id: 'i', snippet: '<svg>', box, name: null, dir: 'rtl', mirrored: false, turned: false, head: null, role: null }] })
    expect(detectFeatures(m, { table: 1, input: 2 })).toEqual(expect.arrayContaining(['tables', 'forms', 'icons']))
    expect(detectFeatures(m, { chat: 1 })).toContain('chat')
  })

  it('finds numbers in Arabic text and stays quiet on a plain page', () => {
    expect(detectFeatures(model([run('a', 'لديك 3 رسائل')]), {})).toContain('numbers-in-text')
    expect(detectFeatures(model([run('a', 'مرحبا بك')]), {})).toEqual([])
  })
})

describe('candidates', () => {
  it('takes Arabic runs, icons and fields in reading order, deduped, capped', () => {
    const m = model(
      [run('t2', 'ثاني', { box: { ...box, y: 50 } }), run('t1', 'أول', { box: { ...box, y: 10 } }), run('en', 'Hello', { blockHasArabic: false }), run('t1', 'أول', { box: { ...box, y: 10 } })],
      { icons: [{ id: 'i', snippet: '<svg>', box: { ...box, y: 30 }, name: null, dir: 'rtl', mirrored: false, turned: false, head: null, role: null }] },
    )
    expect(candidates(m).map((c) => c.id)).toEqual(['t1', 'i', 't2'])
    expect(candidates(m, 2)).toHaveLength(2)
  })

  it('puts items 1px apart in y on one line, right edge first', () => {
    const at = (id: string, x: number, y: number) => run(id, 'نص', { box: { x, y, width: 20, height: 20 } })
    const m = model([at('left', 10, 100), at('right', 200, 101), at('below', 300, 140)])
    expect(candidates(m).map((c) => c.id)).toEqual(['right', 'left', 'below'])
  })
  it('orders by right edge, not left edge', () => {
    const m = model([run('narrow', 'نص', { box: { x: 90, y: 0, width: 10, height: 20 } }), run('wide', 'نص', { box: { x: 50, y: 0, width: 80, height: 20 } })])
    expect(candidates(m).map((c) => c.id)).toEqual(['wide', 'narrow'])
  })
})
