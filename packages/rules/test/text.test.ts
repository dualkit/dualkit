import { describe, expect, it } from 'vitest'
import {
  ARABIC_FAMILY_NAME, isSystemArabicFont, ARABIC_INDIC_DIGIT, ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, LATIN_TOKEN, PLACEHOLDER, WESTERN_DIGIT,
  arabicShare, excerpt, firstStrong, hasArabic, lastStrong,
} from '../src/text'

describe('script detection', () => {
  it('finds Arabic letters but not Arabic-Indic digits alone', () => {
    expect(hasArabic('مرحبا')).toBe(true)
    expect(hasArabic('hello')).toBe(false)
    expect(arabicShare('١٢٣')).toBe(0)
  })

  it('measures how much of the text is Arabic', () => {
    expect(arabicShare('مرحبا')).toBe(1)
    expect(arabicShare('hello')).toBe(0)
    expect(arabicShare('مرحبا hello')).toBeCloseTo(0.5)
    expect(arabicShare('123 !')).toBe(0)
  })

  it('reads the first strong direction', () => {
    expect(firstStrong('  مرحبا hello')).toBe('rtl')
    expect(firstStrong('123 hello مرحبا')).toBe('ltr')
    expect(lastStrong('مرحبا Apple 15')).toBe('ltr')
    expect(lastStrong('Welcome to دبي')).toBe('rtl')
    expect(lastStrong('050 123')).toBeNull()
    expect(firstStrong('١٢٣ ...')).toBeNull()
  })
})

describe('patterns', () => {
  it.each(['050 123 4567', '+971501234567', '4111 1111 1111 1111', '+\u0669\u0667\u0661', '050 \u0661\u0662\u0663', '\u0661\u0662\u0663 456'])('flags %s as a number that can reverse', (s) => {
    expect(GROUPED_NUMBER.test(s)).toBe(true)
  })

  // Chromium paints Arabic-Indic groups first group on the right with or without isolation (see verify.test.ts).
  it.each(['1,234.50', '050-123-4567', '18/02/2026', 'AED 99', '\u0660\u0665\u0660 \u0661\u0662\u0663 \u0664\u0665\u0666\u0667', '\u06F0\u06F5\u06F0 \u06F1\u06F2\u06F3'])('leaves %s alone', (s) => {
    expect(GROUPED_NUMBER.test(s)).toBe(false)
  })

  it.each(['hi@example.com', 'https://dualkit.dev/docs', 'www.example.com', 'ORDER-2041', 'AB12'])('flags %s as a Latin token', (s) => {
    expect(LATIN_TOKEN.test(s)).toBe(true)
  })

  it('does not treat ordinary words as tokens', () => {
    expect(LATIN_TOKEN.test('React')).toBe(false)
  })

  it('spots trailing punctuation, digit systems, placeholders and Arabic fonts', () => {
    expect(ENDS_WITH_PUNCTUATION.test('Hello world!')).toBe(true)
    expect(ENDS_WITH_PUNCTUATION.test('Hello world')).toBe(false)
    expect(WESTERN_DIGIT.test('50')).toBe(true)
    expect(ARABIC_INDIC_DIGIT.test('٥٠')).toBe(true)
    expect(ARABIC_INDIC_DIGIT.test('۵۰')).toBe(true)
    expect(PLACEHOLDER.test('Lorem ipsum dolor')).toBe(true)
    expect(PLACEHOLDER.test('لوريم إيبسوم')).toBe(true)
    expect(ARABIC_FAMILY_NAME.test('IBM Plex Sans Arabic')).toBe(true)
    expect(ARABIC_FAMILY_NAME.test('Tajawal')).toBe(true)
    expect(ARABIC_FAMILY_NAME.test('Inter')).toBe(false)
    for (const generic of ['Segoe UI', 'system-ui', '-apple-system', 'Tahoma']) expect(ARABIC_FAMILY_NAME.test(generic)).toBe(false)
    expect(isSystemArabicFont('geeza pro')).toBe(true)
    expect(isSystemArabicFont('Segoe UI')).toBe(false)
  })

  it('shortens long text for messages', () => {
    expect(excerpt('a'.repeat(60))).toBe(`${'a'.repeat(40)}…`)
    expect(excerpt('short')).toBe('short')
  })
})
