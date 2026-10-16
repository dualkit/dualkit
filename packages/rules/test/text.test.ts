import { describe, expect, it } from 'vitest'
import {
  ARABIC_FONT, ARABIC_INDIC_DIGIT, ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, LATIN_TOKEN, PLACEHOLDER, WESTERN_DIGIT,
  arabicShare, excerpt, firstStrong, hasArabic,
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
    expect(firstStrong('١٢٣ ...')).toBeNull()
  })
})

describe('patterns', () => {
  it.each(['050 123 4567', '+971501234567', '٠٥٠ ١٢٣ ٤٥٦٧', '4111 1111 1111 1111'])('flags %s as a number that can reverse', (s) => {
    expect(GROUPED_NUMBER.test(s)).toBe(true)
  })

  it.each(['1,234.50', '050-123-4567', '18/02/2026', 'AED 99'])('leaves %s alone', (s) => {
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
    expect(ARABIC_FONT.test('IBM Plex Sans Arabic')).toBe(true)
    expect(ARABIC_FONT.test('Tajawal')).toBe(true)
    expect(ARABIC_FONT.test('Inter')).toBe(false)
  })

  it('shortens long text for messages', () => {
    expect(excerpt('a'.repeat(60))).toBe(`${'a'.repeat(40)}…`)
    expect(excerpt('short')).toBe('short')
  })
})
