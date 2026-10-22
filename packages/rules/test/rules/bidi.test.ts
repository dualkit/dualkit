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
  it('flags an email followed by a digit, which Chromium reorders', () => {
    expect(ids(screen({ texts: [text({ text: 'راسلنا على hi@example.com 5', blockText: 'راسلنا على hi@example.com 5' })] }))).toEqual(['bidi/unisolated-latin'])
  })
  it('flags a link with a trailing slash', () => {
    expect(ids(screen({ texts: [text({ text: 'زر https://example.com/a/', blockText: 'زر https://example.com/a/' })] }))).toEqual(['bidi/unisolated-latin'])
  })
  it('flags each digit condition Chromium reorders: a digit directly before, an Extended Arabic-Indic digit after, a dash or Arabic comma before a digit', () => {
    for (const t of ['تم 5https://example.com/a', 'تم \u0665ORDER-2041', 'تم hi@example.com \u06F5', 'تم hi@example.com - 5', 'تم hi@example.com\u060C 5']) {
      expect(ids(screen({ texts: [text({ text: t, blockText: t })] })), t).toEqual(['bidi/unisolated-latin'])
    }
  })
  it('passes an Arabic-Indic digit after the token, or an Arabic word between it and the digit', () => {
    for (const t of ['تم hi@example.com \u0665', 'تم hi@example.com ثم 5']) expect(ids(screen({ texts: [text({ text: t, blockText: t })] })), t).toEqual([])
  })
  it('passes an email, link or code that has no #, trailing slash or digit beside it', () => {
    for (const t of ['راسلنا على hi@example.com', 'زر https://example.com/a/b ثم', 'رقم ORDER-2041 تم', 'اكتب www.example.com ثم']) {
      expect(ids(screen({ texts: [text({ text: t, blockText: t })] })), t).toEqual([])
    }
  })
  it('passes a token that only joins a Latin neighbour', () => {
    expect(ids(screen({ texts: [text({ text: 'تم hi@example.com Apple', blockText: 'تم hi@example.com Apple' })] }))).toEqual([])
  })
  it('passes when isolated', () => {
    expect(ids(screen({ texts: [text({ text: '#A-10293', isolated: true })] }))).toEqual([])
  })
})

describe('bidi/unisolated-number: a leading #', () => {
  const n = (t: string) => ids(screen({ texts: [text({ text: t, blockText: t })] }))
  it('flags # and Western digits after Arabic, and # with Arabic-Indic digits anywhere', () => {
    expect(n('رقم الطلب #10293 تم')).toEqual(['bidi/unisolated-number'])
    expect(n('#\u0663\u0664\u0665 تم')).toEqual(['bidi/unisolated-number'])
  })
  it('passes a lone #, # at the start, # after a Latin word, a colour and an isolated number', () => {
    for (const t of ['اللون # تم', '#10293 تم', 'Order #10293 تم', '5 #10293 تم']) expect(n(t), t).toEqual([])
    expect(ids(screen({ texts: [text({ text: '#10293', blockText: 'رقم #10293', isolated: true })] }))).toEqual([])
  })
  it('only judges the # in its own run, not one in a later isolated run of the same block', () => {
    const blockText = '#12 رقم #34'
    expect(ids(screen({ texts: [text({ text: '#12 رقم', blockText }), text({ text: '#34', blockText, isolated: true })] }))).toEqual([])
    expect(ids(screen({ texts: [text({ text: '#12 رقم', blockText }), text({ text: '#34', blockText })] }))).toEqual(['bidi/unisolated-number'])
  })
  it('reads the # in its place in the block: after Arabic and a digit group it fires, after brackets and quotes alone it does not', () => {
    expect(n('رقم 5 #10293')).toEqual(['bidi/unisolated-number'])
    for (const t of ['(#10293) تم', '"#10293" تم', '. #10293 تم']) expect(n(t), t).toEqual([])
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
  it('passes a hint that lands on the right or in the centre, and a field on a left-to-right page', () => {
    expect(ids(screen({ fields: [field({ dir: 'ltr', placeholderSide: 'right', ...hint })] }))).toEqual([])
    expect(ids(screen({ fields: [field({ dir: 'ltr', placeholderSide: 'center', ...hint })] }))).toEqual([])
    expect(ids(screen({ root: { lang: 'en', dir: 'ltr', computedDir: 'ltr' }, fields: [field({ dir: 'ltr', ...hint })] }))).toEqual([])
  })
})

describe('bidi/date-order', () => {
  const at = (t: string, p: Parameters<typeof text>[0] = {}) => ids(screen({ texts: [text({ text: t, blockText: t, ...p })] }))
  it('flags a dash-joined date in Arabic-Indic digits alone in an RTL block', () => {
    expect(at('١٥-٠٣-٢٠٢٥')).toEqual(['bidi/date-order'])
  })
  it('flags a Western dash-joined date after an Arabic letter', () => {
    expect(at('تاريخ 15-03-2025')).toEqual(['bidi/date-order'])
    expect(ids(screen({ texts: [text({ text: '2025-03-15', blockText: 'تاريخ 2025-03-15' })] }))).toEqual(['bidi/date-order'])
  })
  it('passes a slash-joined date, which holds Arabic numbers together', () => {
    expect(at('تاريخ 15/03/2025')).toEqual([])
    expect(at('15/03/2025')).toEqual([])
    expect(at('١٥/٠٣/٢٠٢٥')).toEqual([])
  })
  it('passes a Western dash-joined date after a Latin letter or with no letter before it', () => {
    expect(at('Date 15-03-2025')).toEqual([])
    expect(at('15-03-2025')).toEqual([])
  })
  it('passes a Western date isolated left to right', () => {
    expect(ids(screen({ texts: [text({ text: '15-03-2025', blockText: 'تاريخ 15-03-2025', isolated: true, forcedLtr: true })] }))).toEqual([])
  })
  it('passes digits that are not a date', () => {
    for (const t of ['هاتف 050-123-4567', 'رمز 12-34-56', 'إصدار 4-2-0']) expect(at(t), t).toEqual([])
  })
  it('flags a worded Arabic date forced left to right', () => {
    expect(at('15 مارس 2025، 10:00 ص', { isolated: true, forcedLtr: true })).toEqual(['bidi/date-order'])
    expect(at('14 ربيع الأول 1447', { isolated: true, forcedLtr: true })).toEqual(['bidi/date-order'])
  })
  it('passes a worded date that is not forced left to right, or that reads whole when forced', () => {
    expect(at('15 مارس 2025، 10:00 ص')).toEqual([])
    expect(at('الأحد 15 مارس 2025', { isolated: true, forcedLtr: true })).toEqual([])
    expect(at('١٥ مارس ٢٠٢٥', { isolated: true, forcedLtr: true })).toEqual([])
  })
  it('stays silent in an LTR block', () => {
    expect(at('١٥-٠٣-٢٠٢٥', { blockDir: 'ltr', dir: 'ltr' })).toEqual([])
    expect(at('15 مارس 2025، 10:00 ص', { blockDir: 'ltr', dir: 'ltr', forcedLtr: true })).toEqual([])
  })
})
