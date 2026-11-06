import { describe, expect, it } from 'vitest'
import { figmaToScreenModel } from '../src/adapter'
import { frame, text } from './fixtures'

describe('figmaToScreenModel', () => {
  it('turns each style segment of a text layer into a run that points at the layer', () => {
    const layer = text('مرحبا Dualkit', {
      id: '4:2', name: 'Greeting', x: 1024, y: 2100,
      pieces: [{ text: 'مرحبا ' }, { text: 'Dualkit', family: 'Inter', weight: 700, style: 'Bold' }],
    })
    const model = figmaToScreenModel(frame([layer], { x: 1000, y: 2000 }))
    expect(model.texts).toHaveLength(2)
    const [arabic, latin] = model.texts
    expect(arabic).toMatchObject({ id: '4:2', snippet: 'Greeting', text: 'مرحبا ', blockText: 'مرحبا Dualkit', blockDir: 'rtl', dir: 'rtl', isLastInBlock: false })
    expect(latin).toMatchObject({ text: 'Dualkit', isLastInBlock: true, font: { families: ['Inter'], weight: 700, size: 16 } })
    expect(arabic!.box).toEqual({ x: 24, y: 100, width: 320, height: 27 })
  })

  it('measures boxes from the checked frame, not the canvas', () => {
    const model = figmaToScreenModel(frame([text('نص', { x: 1010, y: 2020 })], { x: 1000, y: 2000 }))
    expect(model.texts[0]!.box).toMatchObject({ x: 10, y: 20 })
    expect(model.viewportWidth).toBe(390)
  })

  it('reads pixel and percent line height and letter-spacing as pixels, and auto leading as unknown', () => {
    const model = figmaToScreenModel(frame([
      text('أ', { lineHeight: { unit: 'PERCENT', value: 150 }, letterSpacing: { unit: 'PERCENT', value: 5 }, size: 20 }),
      text('ب', { lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 1 } }),
    ]))
    expect(model.texts[0]!.font).toMatchObject({ lineHeight: 30, letterSpacing: 1 })
    expect(model.texts[1]!.font).toMatchObject({ lineHeight: null, letterSpacing: 1 })
  })

  it('counts lines from the layer height and its leading', () => {
    const model = figmaToScreenModel(frame([
      text('سطر', { height: 81, lineHeight: { unit: 'PIXELS', value: 27 } }),
      text('سطر', { height: 10, lineHeight: { unit: 'PIXELS', value: 27 } }),
      text('سطر', { height: 81, lineHeight: { unit: 'AUTO' } }),
    ]))
    expect(model.texts.map((t) => t.lines)).toEqual([3, 1, 1])
  })

  it('reads italic from the font style or the style name', () => {
    const model = figmaToScreenModel(frame([
      text('أ', { italic: true }), text('ب', { style: 'Oblique' }), text('ت', { style: 'Light Italic' }), text('ث'),
    ]))
    expect(model.texts.map((t) => t.font.style)).toEqual(['italic', 'oblique', 'italic', 'normal'])
  })

  it('splits paragraphs into blocks, each with its own direction', () => {
    const model = figmaToScreenModel(frame([text('Hello world!\nمرحبا بكم')]))
    expect(model.texts.map((t) => [t.text, t.blockDir, t.isLastInBlock])).toEqual([
      ['Hello world!', 'ltr', true],
      ['مرحبا بكم', 'rtl', true],
    ])
    expect(new Set(model.texts.map((t) => t.blockId)).size).toBe(2)
  })

  it('skips empty paragraphs and whitespace-only pieces', () => {
    const model = figmaToScreenModel(frame([text('أ\n\n  \nب')]))
    expect(model.texts.map((t) => t.text)).toEqual(['أ', 'ب'])
  })

  it('treats a paragraph with no strong letters as left to right', () => {
    const model = figmaToScreenModel(frame([text('050 123 4567')]))
    expect(model.texts[0]!.blockDir).toBe('ltr')
  })

  it('lists each family once per weight and style as a loaded face, judged by its name', () => {
    const model = figmaToScreenModel(frame([text('أ'), text('ب'), text('Hi', { family: 'Inter', italic: true })]))
    expect(model.fonts).toEqual([
      { family: 'IBM Plex Sans Arabic', weight: [400, 400], style: 'normal', unicodeRange: 'U+0-10FFFF', sizeAdjust: 1, status: 'loaded', drawsArabic: null },
      { family: 'Inter', weight: [400, 400], style: 'italic', unicodeRange: 'U+0-10FFFF', sizeAdjust: 1, status: 'loaded', drawsArabic: null },
    ])
  })

  it('gives each text layer a layout node with its alignment and slack', () => {
    const model = figmaToScreenModel(frame([
      text('نص عربي طويل', { align: 'LEFT' }),
      text('نص', { align: 'CENTER', autoResize: 'WIDTH_AND_HEIGHT' }),
      text('Text', { align: 'JUSTIFIED' }),
    ]))
    expect(model.layouts.map((l) => [l.dir, l.textAlign, l.hasArabicText, l.textSlack > 0])).toEqual([
      ['rtl', 'left', true, true],
      ['rtl', 'center', true, false],
      ['ltr', 'justify', false, true],
    ])
  })

  it('walks nested containers and sets the root direction from the share of Arabic', () => {
    const nested = frame([frame([text('مرحبا بكم في التطبيق')], { id: '0:2' })])
    const model = figmaToScreenModel(nested)
    expect(model.texts).toHaveLength(1)
    expect(model.root).toEqual({ lang: null, dir: null, computedDir: 'rtl' })
    expect(figmaToScreenModel(frame([text('Hello')])).root.computedDir).toBe('ltr')
  })

  it('accepts a text layer as the root', () => {
    const model = figmaToScreenModel(text('مرحبا', { x: 50 }))
    expect(model.texts[0]!.box.x).toBe(0)
    expect(model.viewportWidth).toBe(320)
  })

  it('fills the parts of the model Figma has no data for with empty lists', () => {
    const model = figmaToScreenModel(frame([text('أ')]))
    expect(model).toMatchObject({ icons: [], fields: [], labels: [], clips: [], joins: [], unreadableStylesheets: 0 })
    expect(model.texts[0]).toMatchObject({ isolated: false, forcedLtr: false, lang: null, signs: [], mirrored: false, mirroredBy: null, endsLine: false })
  })
})
