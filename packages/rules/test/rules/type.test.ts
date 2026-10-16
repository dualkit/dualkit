import { describe, expect, it } from 'vitest'
import { typeRules } from '../../src/rules/type'
import { runRules } from '../../src/run'
import { screen, text } from '../helpers/model'

const font = text().font
const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: typeRules }).map((f) => f.rule)

describe('type rules', () => {
  it('passes well-set Arabic', () => {
    expect(ids(screen({ texts: [text()] }))).toEqual([])
  })
  it('flags tight leading only on multi-line Arabic', () => {
    expect(ids(screen({ texts: [text({ lines: 3, font: { ...font, lineHeight: 19 } })] }))).toEqual(['type/arabic-leading'])
    expect(ids(screen({ texts: [text({ lines: 1, font: { ...font, lineHeight: 19 } })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ lines: 3, font: { ...font, lineHeight: null } })] }))).toEqual([])
  })
  it('flags letter-spacing, italics and small sizes', () => {
    expect(ids(screen({ texts: [text({ font: { ...font, letterSpacing: 1.6 } })] }))).toEqual(['type/arabic-tracking'])
    expect(ids(screen({ texts: [text({ font: { ...font, style: 'italic' } })] }))).toEqual(['type/arabic-italic'])
    expect(ids(screen({ texts: [text({ font: { ...font, size: 12 } })] }))).toEqual(['type/arabic-size'])
  })
  it('flags a font stack with no Arabic face, once per stack', () => {
    const latin = { ...font, families: ['Inter', 'sans-serif'] }
    expect(ids(screen({ texts: [text({ font: latin }), text({ font: latin })] }))).toEqual(['type/arabic-font'])
  })
  it('ignores Latin text', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello', font: { ...font, size: 11, letterSpacing: 2, style: 'italic', families: ['Inter'] } })] }))).toEqual([])
  })
})
