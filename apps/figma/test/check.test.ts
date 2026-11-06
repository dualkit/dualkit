import { RULES } from '@dualkit/rules'
import { describe, expect, it } from 'vitest'
import { checkFrame } from '../src/check'
import { CHECKED_IN_FIGMA, NOT_CHECKED_IN_FIGMA } from '../src/coverage'
import { frame, text } from './fixtures'

const ruleIds = (result: ReturnType<typeof checkFrame>): string[] => result.groups.map((g) => g.rule)

describe('which rules run in Figma', () => {
  it('accounts for every rule exactly once, so a new rule needs a decision', () => {
    const checked = CHECKED_IN_FIGMA.map((r) => r.id)
    const skipped = NOT_CHECKED_IN_FIGMA.map((r) => r.id)
    expect([...checked, ...skipped].sort()).toEqual(RULES.map((r) => r.id).sort())
    expect(checked.filter((id) => skipped.includes(id))).toEqual([])
  })

  it('gives a reason for every rule it does not check', () => {
    for (const r of NOT_CHECKED_IN_FIGMA) expect(r.reason).toMatch(/\.$/)
  })

  it('runs the type rules and the text-based bidi and content rules', () => {
    const checked = CHECKED_IN_FIGMA.map((r) => r.id)
    expect(checked).toEqual(expect.arrayContaining(['type/arabic-font', 'type/arabic-leading', 'type/arabic-tracking', 'bidi/unisolated-number', 'content/mixed-digits']))
    expect(checked).not.toContain('content/missing-lang')
  })
})

describe('checkFrame: bad fixtures', () => {
  it('flags Arabic set in a Latin-only font', () => {
    const result = checkFrame(frame([text('مرحبا بكم', { id: '9:1', family: 'Inter' })]))
    expect(ruleIds(result)).toEqual(['type/arabic-font'])
    expect(result.groups[0]!.hits[0]).toMatchObject({ layerId: '9:1' })
  })

  it('stays quiet when only the Latin segment of a mixed layer uses a Latin font', () => {
    const layer = text('ادفع عبر Apple Pay', { pieces: [{ text: 'ادفع عبر ' }, { text: 'Apple Pay', family: 'Inter' }] })
    expect(checkFrame(frame([layer])).groups).toEqual([])
  })

  it('flags the Arabic segment of a mixed layer set in a Latin font', () => {
    const layer = text('Pay ادفع', { pieces: [{ text: 'Pay ', family: 'Inter' }, { text: 'ادفع', family: 'Inter' }] })
    expect(ruleIds(checkFrame(frame([layer])))).toEqual(['type/arabic-font'])
  })

  it('flags tight Arabic leading on body text over two lines', () => {
    const result = checkFrame(frame([text('نص عربي على سطرين', { lineHeight: { unit: 'PIXELS', value: 20 }, height: 40 })]))
    expect(ruleIds(result)).toEqual(['type/arabic-leading'])
    expect(result.groups[0]!.hits[0]!.message).toContain('1.25')
  })

  it('flags tight leading set in percent', () => {
    expect(ruleIds(checkFrame(frame([text('نص عربي', { lineHeight: { unit: 'PERCENT', value: 120 }, height: 40 })])))).toEqual(['type/arabic-leading'])
  })

  it('flags letter-spacing on Arabic', () => {
    expect(ruleIds(checkFrame(frame([text('مرحبا', { letterSpacing: { unit: 'PERCENT', value: 5 } })])))).toEqual(['type/arabic-tracking'])
  })

  it('flags slanted and small Arabic', () => {
    const result = checkFrame(frame([text('مرحبا', { italic: true }), text('تفاصيل', { size: 11, lineHeight: { unit: 'PIXELS', value: 18 } })]))
    expect(ruleIds(result).sort()).toEqual(['type/arabic-italic', 'type/arabic-size'])
  })

  it('flags a phone number inside an Arabic sentence', () => {
    const result = checkFrame(frame([text('اتصل بنا على 050 123 4567', { id: '7:7' })]))
    expect(ruleIds(result)).toEqual(['bidi/unisolated-number'])
    expect(result.groups[0]!.hits[0]!.layerId).toBe('7:7')
  })

  it('flags a dash-joined date after Arabic', () => {
    expect(ruleIds(checkFrame(frame([text('تاريخ الطلب 15-03-2025')])))).toEqual(['bidi/date-order'])
  })

  it('flags two digit systems on one screen, on the minority layer', () => {
    const result = checkFrame(frame([
      text('السعر ٥٠ درهم', { id: '2:1' }),
      text('المجموع 120 درهم', { id: '2:2' }),
      text('الضريبة 6 درهم', { id: '2:3' }),
    ]))
    expect(ruleIds(result)).toEqual(['content/mixed-digits'])
    expect(result.groups[0]!.hits.map((h) => h.layerId)).toEqual(['2:1'])
  })

  it('flags placeholder text, Latin commas and a currency before its number', () => {
    const result = checkFrame(frame([
      text('Lorem ipsum dolor sit amet', { family: 'Inter', align: 'LEFT' }),
      text('مرحبا, أهلا'),
      text('السعر د.إ 25'),
    ]))
    expect(ruleIds(result).sort()).toEqual(['content/currency-order', 'content/latin-punctuation', 'content/placeholder-text'])
  })

  it('flags Arabic pinned to the left of a fixed-width box', () => {
    expect(ruleIds(checkFrame(frame([text('نص عربي في صندوق', { align: 'LEFT' })])))).toEqual(['layout/text-align-left'])
  })

  it('groups several hits of one rule together and sorts errors first', () => {
    const result = checkFrame(frame([
      text('أ', { letterSpacing: { unit: 'PIXELS', value: 2 } }),
      text('ب', { letterSpacing: { unit: 'PIXELS', value: 2 } }),
      text('نص عربي', { lineHeight: { unit: 'PIXELS', value: 18 }, height: 36 }),
    ]))
    expect(result.groups.map((g) => [g.rule, g.severity, g.hits.length])).toEqual([
      ['type/arabic-tracking', 'error', 2],
      ['type/arabic-leading', 'warning', 1],
    ])
    expect(result.groups[0]!.docs).toMatch(/^https:\/\/github\.com\/dualkit\/dualkit\/blob\/main\/packages\/rules\/RULES\.md#type-arabic-tracking$/)
    expect(result.groups[0]!.fix).toMatch(/letter-spacing/)
  })
})

describe('checkFrame: clean fixtures', () => {
  it('finds nothing on a well-set Arabic screen', () => {
    const result = checkFrame(frame([
      text('حسابي', { size: 24, weight: 700, style: 'Bold', lineHeight: { unit: 'PIXELS', value: 32 } }),
      text('أرسل المبلغ إلى رقم الهاتف أدناه وسيصلك إشعار عند اكتمال التحويل.', { height: 54 }),
      text('050 123 4567', { align: 'LEFT', family: 'Inter' }),
      text('AE07 0331 2345 6789 0123 456', { align: 'LEFT', family: 'Inter' }),
      text('1,234.50 د.إ'),
      text('1 رمضان 1447 هـ', { autoResize: 'WIDTH_AND_HEIGHT' }),
    ]))
    expect(result.findings).toEqual([])
    expect(result.layers).toBe(6)
  })

  it('finds nothing on an English screen', () => {
    const result = checkFrame(frame([
      text('Account', { family: 'Inter', align: 'LEFT', letterSpacing: { unit: 'PERCENT', value: 4 } }),
      text('Call us on 050 123 4567.', { family: 'Inter', align: 'LEFT', lineHeight: { unit: 'PERCENT', value: 120 }, height: 40 }),
    ]))
    expect(result.findings).toEqual([])
  })

  it('finds nothing when Arabic uses an Arabic system font', () => {
    expect(checkFrame(frame([text('مرحبا', { family: 'Geeza Pro' })])).findings).toEqual([])
  })

  it('finds nothing on Arabic text clipped outside the frame', () => {
    expect(checkFrame(frame([text('نص عربي', { x: 900, lineHeight: { unit: 'PIXELS', value: 18 }, height: 36 })])).findings).toEqual([])
  })

  it('lists the rules it did not check', () => {
    const result = checkFrame(frame([]))
    expect(result.notChecked.map((r) => r.id)).toContain('content/missing-lang')
    expect(result.notChecked[0]).toHaveProperty('title')
    expect(result.layers).toBe(0)
  })
})
