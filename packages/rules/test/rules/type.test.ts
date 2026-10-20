import { describe, expect, it } from 'vitest'
import { coversArabic, effectiveSize, loadedArabicFace } from '../../src/fonts'
import { typeRules } from '../../src/rules/type'
import { runRules } from '../../src/run'
import { face, screen, text } from '../helpers/model'

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
  const withFamilies = (families: string[]) => text({ font: { ...font, families } })
  const messages = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: typeRules }).map((f) => f.message)
  describe('type/arabic-font', () => {
    it('passes a stack whose Arabic family is loaded', () => {
      expect(ids(screen({ texts: [withFamilies(['IBM Plex Sans Arabic', 'sans-serif'])], fonts: [face()] }))).toEqual([])
      expect(ids(screen({ texts: [withFamilies(['ibm plex sans arabic'])], fonts: [face()] }))).toEqual([])
    })
    it('fails a named family that never loaded, or errored', () => {
      const t = withFamilies(['IBM Plex Sans Arabic', 'sans-serif'])
      expect(messages(screen({ texts: [t], fonts: [] }))).toEqual(['"IBM Plex Sans Arabic" is named but never loaded.'])
      expect(messages(screen({ texts: [t], fonts: [face({ status: 'error' })] }))).toEqual(['"IBM Plex Sans Arabic" is named but never loaded.'])
      expect(ids(screen({ texts: [t], fonts: [face({ status: 'unloaded' })] }))).toEqual(['type/arabic-font'])
    })
    it('fails a loaded face that does not cover Arabic', () => {
      expect(ids(screen({ texts: [withFamilies(['IBM Plex Sans Arabic'])], fonts: [face({ unicodeRange: 'U+0000-00FF' })] }))).toEqual(['type/arabic-font'])
    })
    it('does not count a loaded Latin webfont with the default range', () => {
      const t = withFamilies(['Inter', 'sans-serif'])
      expect(messages(screen({ texts: [t], fonts: [face({ family: 'Inter' })] }))).toEqual(['Arabic falls back from Inter, sans-serif.'])
    })
    it('counts a loaded default-range face under any name when the page measured it drawing Arabic', () => {
      const t = withFamilies(['GE SS Two', 'sans-serif'])
      expect(ids(screen({ texts: [t], fonts: [face({ family: 'GE SS Two', drawsArabic: true })] }))).toEqual([])
      expect(ids(screen({ texts: [t], fonts: [face({ family: 'GE SS Two', drawsArabic: false })] }))).toEqual(['type/arabic-font'])
      expect(ids(screen({ texts: [t], fonts: [face({ family: 'GE SS Two', drawsArabic: null })] }))).toEqual(['type/arabic-font'])
    })
    it('says a face that is still loading had not finished within 3 seconds', () => {
      const t = withFamilies(['IBM Plex Sans Arabic', 'sans-serif'])
      expect(messages(screen({ texts: [t], fonts: [face({ status: 'loading' })] }))).toEqual(['"IBM Plex Sans Arabic" had not finished loading within 3 seconds.'])
    })
    it('counts a loaded face with an explicit Arabic range under any name', () => {
      const brand = face({ family: 'Brand', unicodeRange: 'U+0600-06FF, U+0750-077F' })
      expect(ids(screen({ texts: [withFamilies(['Brand', 'sans-serif'])], fonts: [brand] }))).toEqual([])
    })
    it('falls back as before for Latin stacks', () => {
      expect(messages(screen({ texts: [withFamilies(['Inter', 'sans-serif'])] }))).toEqual(['Arabic falls back from Inter, sans-serif.'])
    })
    it('passes on a system Arabic font, even unloaded', () => {
      expect(ids(screen({ texts: [withFamilies(['SF Arabic', 'Segoe UI', 'sans-serif'])], fonts: [] }))).toEqual([])
    })
    it('does not pass on Latin-first system fonts or generics', () => {
      expect(ids(screen({ texts: [withFamilies(['Segoe UI', 'Tahoma', 'sans-serif'])], fonts: [] }))).toEqual(['type/arabic-font'])
      expect(ids(screen({ texts: [withFamilies(['system-ui'])], fonts: [] }))).toEqual(['type/arabic-font'])
      expect(ids(screen({ texts: [withFamilies(['-apple-system', 'BlinkMacSystemFont'])], fonts: [] }))).toEqual(['type/arabic-font'])
    })
  })
  describe('type/arabic-size and size-adjust', () => {
    it('counts a size-adjust above 1 toward the effective size', () => {
      expect(ids(screen({ texts: [text({ font: { ...font, size: 13 } })], fonts: [face({ sizeAdjust: 1.1 })] }))).toEqual([])
    })
    it('flags a size-adjust below 1 and shows both numbers', () => {
      const m = screen({ texts: [text({ font: { ...font, size: 15 } })], fonts: [face({ sizeAdjust: 0.9 })] })
      expect(messages(m)).toEqual([expect.stringContaining('15px')])
      expect(messages(m)[0]).toContain('13.5px')
    })
    it('uses the Arabic face of a split family', () => {
      const fonts = [
        face({ family: 'Brand', unicodeRange: 'U+0600-06FF', weight: [500, 500], sizeAdjust: 1.12 }),
        face({ family: 'Brand', unicodeRange: 'U+0-10FFFF', weight: [400, 400], sizeAdjust: 1 }),
      ]
      const t = text({ font: { ...font, families: ['Brand', 'sans-serif'], size: 13, weight: 400 } })
      expect(effectiveSize(t, fonts)).toBeCloseTo(14.56)
      expect(ids(screen({ texts: [t], fonts }))).toEqual([])
    })
    it('gives one size for a 13.3333px button label with no size-adjust', () => {
      const m = screen({ texts: [text({ font: { ...font, size: 13.3333 } })], fonts: [face()] })
      expect(messages(m)).toEqual(['"مرحبا" is 13.3333px.'])
    })
    it('ignores size-adjust on system fonts', () => {
      expect(ids(screen({ texts: [withFamilies(['SF Arabic'])], fonts: [face({ sizeAdjust: 0.5 })] }))).toEqual([])
    })
  })
  describe('type/arabic-faux-bold', () => {
    const bold = (families = ['IBM Plex Sans Arabic', 'sans-serif'], weight = 700) => text({ font: { ...font, families, weight } })
    it('flags a bold run when only a regular face is loaded', () => {
      expect(ids(screen({ texts: [bold()], fonts: [face()] }))).toEqual(['type/arabic-faux-bold'])
    })
    it('passes with a bold face, a variable face, or regular weight', () => {
      expect(ids(screen({ texts: [bold()], fonts: [face(), face({ weight: [700, 700] })] }))).toEqual([])
      expect(ids(screen({ texts: [bold()], fonts: [face({ weight: [100, 900] })] }))).toEqual([])
      expect(ids(screen({ texts: [bold(undefined, 500)], fonts: [face()] }))).toEqual([])
    })
    it('passes a 700 run when the heaviest loaded face is 600, which Chromium does not synthesise', () => {
      expect(ids(screen({ texts: [bold()], fonts: [face({ weight: [600, 600] })] }))).toEqual([])
      expect(ids(screen({ texts: [bold(undefined, 600)], fonts: [face({ weight: [500, 500] })] }))).toEqual(['type/arabic-faux-bold'])
    })
    it('does not judge against faces that are unloaded or errored', () => {
      // type/arabic-font reports a face that never loads, so faux bold stays quiet about it.
      for (const status of ['unloaded', 'error'] as const) {
        expect(ids(screen({ texts: [bold()], fonts: [face({ status })] }))).not.toContain('type/arabic-faux-bold')
      }
    })
    it('never judges system fonts', () => {
      expect(ids(screen({ texts: [bold(['SF Arabic', 'sans-serif'])], fonts: [face()] }))).toEqual([])
      expect(ids(screen({ texts: [bold(['SF Arabic', 'IBM Plex Sans Arabic'])], fonts: [face()] }))).toEqual([])
    })
    it('judges the first declared family, not a later one', () => {
      expect(ids(screen({ texts: [bold(['Brand', 'IBM Plex Sans Arabic'])], fonts: [face(), face({ family: 'Brand', weight: [700, 700] })] }))).toEqual([])
    })
    it('does not judge a family that has no Arabic face', () => {
      expect(ids(screen({ texts: [bold(['Inter', 'SF Arabic'])], fonts: [face({ family: 'Inter', unicodeRange: 'U+0000-00FF' })] }))).toEqual([])
    })
  })
  describe('font helpers', () => {
    it('reads unicode ranges', () => {
      expect(coversArabic(face({ unicodeRange: 'U+0600-06FF, U+0750-077F' }))).toBe(true)
      expect(coversArabic(face({ unicodeRange: 'U+07??' }))).toBe(false)
      expect(coversArabic(face({ unicodeRange: 'U+0000-00FF' }))).toBe(false)
      expect(coversArabic(face({ unicodeRange: 'U+0627' }))).toBe(true)
      expect(coversArabic(face({ family: 'Inter', unicodeRange: 'U+0-10FFFF' }))).toBe(false)
      expect(coversArabic(face({ family: 'IBM Plex Sans Arabic', unicodeRange: 'U+0-10FFFF' }))).toBe(true)
      expect(coversArabic(face({ family: 'Brand', unicodeRange: 'U+0600-06FF' }))).toBe(true)
    })
    it('finds the loaded Arabic face in a stack', () => {
      expect(loadedArabicFace(['Inter', 'IBM Plex Sans Arabic'], [face()])?.family).toBe('IBM Plex Sans Arabic')
      expect(loadedArabicFace(['Inter'], [face()])).toBeNull()
    })
    it('computes the effective size', () => {
      expect(effectiveSize(text({ font: { ...font, size: 20 } }), [face({ sizeAdjust: 0.9 })])).toBeCloseTo(18)
      expect(effectiveSize(text({ font: { ...font, size: 20 } }), [])).toBe(20)
    })
  })
  describe('type/arabic-broken-join', () => {
    const join = { id: 'p>span', snippet: '<span>', box: { x: 0, y: 0, width: 10, height: 10 }, reason: 'inline-block' as const, word: 'محمد' }
    it('flags a word split by a box, as an error', () => {
      const found = runRules(screen({ joins: [join] }), { rules: typeRules })
      expect(found.map((f) => [f.rule, f.severity])).toEqual([['type/arabic-broken-join', 'error']])
      expect(found[0]!.message).toBe('"محمد" is split by an inline-block box, so its letters do not join.')
    })
    it('says inline-flex when that is the box', () => {
      expect(runRules(screen({ joins: [{ ...join, reason: 'other' }] }), { rules: typeRules })[0]!.message).toContain('an inline-flex box')
    })
    it('names a font change as the cause', () => {
      expect(runRules(screen({ joins: [{ ...join, reason: 'font-family' }] }), { rules: typeRules })[0]!.message).toContain('changes font inside the word')
    })
    it('stays quiet with no joins', () => {
      expect(ids(screen({ joins: [] }))).toEqual([])
    })
  })
  it('ignores Latin text', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello', font: { ...font, size: 11, letterSpacing: 2, style: 'italic', families: ['Inter'] } })] }))).toEqual([])
  })
})
