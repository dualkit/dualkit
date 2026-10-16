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
  it('passes start, right, or elements without text', () => {
    expect(ids(screen({ layouts: [layout({ textAlign: 'start' }), layout({ textAlign: 'right' }), layout({ textAlign: 'left', hasOwnText: false })] }))).toEqual([])
  })
})

describe('layout/arabic-ltr-block', () => {
  it('flags an Arabic paragraph laid out left to right, once per block', () => {
    const t = { text: 'مرحبا بكم', blockText: 'مرحبا بكم في المتجر', blockDir: 'ltr' as const, blockId: 'b1' }
    expect(ids(screen({ texts: [text(t), text(t)] }))).toEqual(['layout/arabic-ltr-block'])
  })
  it('passes mostly-English LTR blocks', () => {
    expect(ids(screen({ texts: [text({ text: 'Welcome مرحبا to the shop', blockText: 'Welcome مرحبا to the shop', blockDir: 'ltr' })] }))).toEqual([])
  })
})
