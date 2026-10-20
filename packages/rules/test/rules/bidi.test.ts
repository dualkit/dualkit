import { describe, expect, it } from 'vitest'
import { bidiRules } from '../../src/rules/bidi'
import { runRules } from '../../src/run'
import { field, screen, text } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: bidiRules }).map((f) => f.rule)

describe('bidi/unisolated-number', () => {
  it('flags a spaced phone number in RTL text', () => {
    expect(ids(screen({ texts: [text({ text: 'الهاتف 050 123 4567' })] }))).toEqual(['bidi/unisolated-number'])
  })
  it('passes when it is isolated or the paragraph is LTR', () => {
    expect(ids(screen({ texts: [text({ text: '050 123 4567', isolated: true })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: '050 123 4567', blockText: 'Phone 050 123 4567', blockDir: 'ltr' })] }))).toEqual([])
  })
})

describe('bidi/unisolated-latin', () => {
  it('flags an email inside Arabic', () => {
    expect(ids(screen({ texts: [text({ text: 'راسلنا على hi@example.com', blockText: 'راسلنا على hi@example.com' })] }))).toContain('bidi/unisolated-latin')
  })
  it('passes when isolated', () => {
    expect(ids(screen({ texts: [text({ text: 'hi@example.com', isolated: true })] }))).toEqual([])
  })
})

describe('bidi/unisolated-latin: order codes', () => {
  const flagged = (t: string) => ids(screen({ texts: [text({ text: t, blockText: `رقم الطلب ${t} تم` })] }))
  it('flags a hash-prefixed code, which Chromium scrambles', () => {
    expect(flagged('#A-10293')).toEqual(['bidi/unisolated-latin'])
    expect(flagged('#A10293')).toEqual(['bidi/unisolated-latin'])
  })
  it('passes the near misses, and an isolated code', () => {
    for (const t of ['Visa', 'A1', 'iPhone 15', 'A10293', 'في عام 2026']) expect(flagged(t), t).toEqual([])
    expect(ids(screen({ texts: [text({ text: '#A-10293', isolated: true })] }))).toEqual([])
  })
})

describe('bidi/punctuation-flip', () => {
  it('flags English ending in punctuation inside an RTL block', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello world!', blockText: 'Hello world!' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('flags Arabic ending in punctuation inside an LTR block', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!', blockDir: 'ltr' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('passes an Arabic-majority paragraph that starts with a Latin word', () => {
    expect(ids(screen({ texts: [text({ text: 'iPhone 15 متوفر الآن.', blockText: 'iPhone 15 متوفر الآن.', blockDir: 'rtl' })] }))).toEqual([])
  })
  it('flags a mostly English paragraph set right to left', () => {
    expect(ids(screen({ texts: [text({ text: 'Download the app now مجانا!', blockText: 'Download the app now مجانا!', blockDir: 'rtl' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('passes when the text matches its block, or is not last', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!' })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: 'Hi!', blockText: 'Hi! مرحبا', isLastInBlock: false })] }))).toEqual([])
  })
})

describe('bidi/punctuation-flip: a mark that closes a line before a <br>', () => {
  const line = (p: Parameters<typeof text>[0]) => ids(screen({ texts: [text({ isLastInBlock: false, endsLine: true, ...p })] }))
  it('flags English closing a line in an RTL block, and Arabic closing a line in an LTR block', () => {
    expect(line({ text: 'Hello world!', blockText: 'Hello world! مرحبا بكم' })).toEqual(['bidi/punctuation-flip'])
    expect(line({ text: 'مرحبا بكم في المتجر.', blockText: 'مرحبا بكم في المتجر. Hello there', blockDir: 'ltr' })).toEqual(['bidi/punctuation-flip'])
  })
  it('passes a line that matches its block, no closing mark, or an isolated run', () => {
    expect(line({ text: 'مرحبا بكم في المتجر.', blockText: 'مرحبا بكم في المتجر. Hello there' })).toEqual([])
    expect(line({ text: 'Hello world', blockText: 'Hello world مرحبا بكم' })).toEqual([])
    expect(line({ text: 'Hello world!', blockText: 'Hello world! مرحبا بكم', isolated: true })).toEqual([])
  })
  it('passes a run that is neither last nor line-ending', () => {
    expect(line({ text: 'Hello world!', blockText: 'Hello world! مرحبا بكم', endsLine: false })).toEqual([])
  })
})

describe('bidi/field-direction', () => {
  it('flags an email field that inherits RTL', () => {
    expect(ids(screen({ fields: [field()] }))).toEqual(['bidi/field-direction'])
  })
  it('passes with a dir attribute, LTR direction, or a free-text field', () => {
    expect(ids(screen({ fields: [field({ dirAttr: 'auto' }), field({ dir: 'ltr' }), field({ kind: 'text' })] }))).toEqual([])
  })
})

describe('bidi/field-placeholder', () => {
  const hint = { placeholder: 'البريد الإلكتروني' }
  it('flags an Arabic placeholder in a left-to-right field', () => {
    expect(ids(screen({ fields: [field({ dir: 'ltr', dirAttr: 'ltr', ...hint })] }))).toEqual(['bidi/field-placeholder'])
    expect(ids(screen({ fields: [field({ dir: 'ltr', kind: 'tel', ...hint })] }))).toEqual(['bidi/field-placeholder'])
  })
  it('passes a Latin placeholder, an RTL field, no placeholder, and a placeholder a value hides', () => {
    expect(ids(screen({ fields: [field({ dir: 'ltr', placeholder: 'name@example.com' })] }))).toEqual([])
    expect(ids(screen({ fields: [field({ dir: 'rtl', kind: 'text', ...hint })] }))).toEqual([])
    expect(ids(screen({ fields: [field({ dir: 'ltr' })] }))).toEqual([])
    expect(ids(screen({ fields: [field({ dir: 'ltr', placeholderShown: false, ...hint })] }))).toEqual([])
  })
})
