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

describe('bidi/punctuation-flip', () => {
  it('flags English ending in punctuation inside an RTL block', () => {
    expect(ids(screen({ texts: [text({ text: 'Hello world!', blockText: 'Hello world!' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('flags Arabic ending in punctuation inside an LTR block', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!', blockDir: 'ltr' })] }))).toEqual(['bidi/punctuation-flip'])
  })
  it('passes when the text matches its block, or is not last', () => {
    expect(ids(screen({ texts: [text({ text: 'مرحبا!', blockText: 'مرحبا!' })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: 'Hi!', blockText: 'Hi! مرحبا', isLastInBlock: false })] }))).toEqual([])
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
