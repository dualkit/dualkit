import { coversCodePoint } from '../fonts'
import type { LoadedFace, TextRun } from '../model'
import { defineRule, pick } from '../rule'
import { ARABIC_INDIC_DIGIT, PLACEHOLDER, currencyFirst, latinPunctuationMarks, WESTERN_DIGIT, arabicShare, arabicWordCount, excerpt, isArabicScriptLang, latinWordCount } from '../text'


export const missingLang = defineRule({
  id: 'content/missing-lang', group: 'content', severity: 'error',
  title: 'No page language',
  why: 'Without lang on <html>, screen readers guess the language and browsers pick the wrong fonts and line breaks.',
  fix: 'Add lang="ar" or lang="en" to <html>.',
  check: (m) => (m.root.lang ? [] : [{ node: null, message: 'The page has no lang attribute.' }]),
})

/** Why a page whose body computes left to right got there, from the dir attribute it was given. */
function ltrReason(dir: string | null): string {
  const d = (dir ?? '').toLowerCase()
  // dir="auto" takes the first strong character, so a page opening with a Latin word such as iPhone runs left to right.
  if (d === 'auto') return 'dir="auto" took the direction of a leading Latin word'
  if (d === 'rtl') return 'the body or a stylesheet sets it back'
  return '<html> has no dir="rtl"'
}

export const missingDir = defineRule({
  id: 'content/missing-dir', group: 'content', severity: 'error',
  title: 'An Arabic page without dir="rtl"',
  why: 'The page is mostly Arabic but the document still runs left to right, so the whole layout starts on the wrong side.',
  fix: 'Set dir="rtl" on <html> whenever lang is Arabic.',
  check: (m) => {
    const share = arabicShare(m.texts.map((t) => t.text).join(' '))
    if (share <= 0.3 || m.root.computedDir === 'rtl') return []
    return [{ node: null, message: `The page runs left to right because ${ltrReason(m.root.dir)}, but ${Math.round(share * 100)}% of the text is Arabic.` }]
  },
})

export const langMismatch = defineRule({
  id: 'content/lang-mismatch', group: 'content', severity: 'warning',
  title: 'Arabic tagged as another language',
  why: 'Screen readers read this Arabic with the wrong voice.',
  fix: 'Put lang="ar" on the element that holds the Arabic.',
  check: (m) => m.texts
    .filter((t): t is TextRun & { lang: string } => t.lang !== null && arabicShare(t.text) > 0.5 && !isArabicScriptLang(t.lang))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is tagged ${t.lang}.` })),
})

export const mixedDigits = defineRule({
  id: 'content/mixed-digits', group: 'content', severity: 'warning',
  title: 'Two digit systems on one screen',
  why: 'Mixing 50 and ٥٠ in the same Arabic interface looks unfinished and makes numbers harder to compare.',
  fix: 'Pick one digit system for the product and format every number with it.',
  check: (m) => {
    const inArabic = m.texts.filter((t) => t.blockHasArabic)
    const western = inArabic.filter((t) => WESTERN_DIGIT.test(t.text))
    const indic = inArabic.filter((t) => ARABIC_INDIC_DIGIT.test(t.text))
    if (western.length === 0 || indic.length === 0) return []
    const minority = indic.length <= western.length ? indic : western
    return minority.map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" uses a different digit system from the rest of the screen.` }))
  },
})

export const placeholderText = defineRule({
  id: 'content/placeholder-text', group: 'content', severity: 'warning',
  title: 'Placeholder text left in',
  why: 'Lorem ipsum, in Latin or Arabic, hides how real copy will wrap and reads as unfinished.',
  fix: 'Replace it with real copy, or realistic Gulf sample data.',
  check: (m) => m.texts
    .filter((t) => PLACEHOLDER.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is placeholder text.` })),
})

export const oldRialSign = defineRule({
  id: 'content/old-rial-sign', group: 'content', severity: 'warning',
  title: 'The old rial ligature used as a riyal sign',
  why: 'U+FDFC is the Persian word for rial drawn as one glyph, so it reads as a different currency mark and many fonts draw it differently or not at all.',
  fix: 'Use ⃁ (U+20C1) for the Saudi riyal with a font that has it, or write ر.س or SAR.',
  check: (m) => m.texts
    // dualkit-disable-next-line source/old-rial-sign -- the sign this check looks for
    .filter((t) => t.text.includes('\uFDFC'))
    // dualkit-disable-next-line source/old-rial-sign -- the check message names the sign
    .map((t) => ({ node: pick(t), message: '﷼ is the rial ligature, not the Saudi riyal sign.' })),
})

const NEW_SIGNS = [0x20c1, 0x20c3, 0x20c4] as const
const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase()}`
const loadedIn = (families: string[], fonts: LoadedFace[]): LoadedFace[] =>
  fonts.filter((f) => f.status === 'loaded' && families.some((fam) => fam.toLowerCase() === f.family.toLowerCase()))

export const currencySignFont = defineRule({
  id: 'content/currency-sign-font', group: 'content', severity: 'warning',
  title: 'A new currency sign no loaded font draws',
  why: 'The Saudi riyal, UAE dirham and Omani rial signs are new to Unicode, so a font without them draws a blank box, or whatever the visitor\'s device happens to have.',
  fix: 'Load a font that has the sign, or write the currency code instead.',
  // A loaded face in the stack counts when its explicit unicode-range includes the sign (fast path), or when the reader
  // measured the run's webfont drawing it. A default-range face alone proves nothing: IBM Plex Sans Arabic has that
  // range and draws these as missing-glyph boxes, while a face that does have the glyph shows up in `signs`.
  check: (m) => m.texts.flatMap((t) => {
    const faces = loadedIn(t.font.families, m.fonts)
    const drawn = (cp: number): boolean => t.signs.some((s) => s.codePoint === cp && s.drawnByWebfont)
    const missing = NEW_SIGNS.filter((cp) => t.text.includes(String.fromCodePoint(cp)) && !faces.some((f) => coversCodePoint(f, cp)) && !drawn(cp))
    return missing.length === 0 ? [] : [{ node: pick(t), message: `${missing.map(hex).join(' and ')} in "${excerpt(t.text)}" is not drawn by any loaded font in this text's font stack.` }]
  }),
})

// The Central Bank of the UAE guideline (centralbank.ae, Dirham Currency Symbol Guideline v1.0, p. 11 and p. 19) says
// never to use the symbol and "AED" together. It says nothing about "Dh" or the Arabic word, so those never fire.
const AED_CODE = /\bAED\b/i

export const dirhamSignWithCode = defineRule({
  id: 'content/dirham-sign-with-code', group: 'content', severity: 'note',
  title: 'The dirham sign next to the code AED',
  why: 'The Central Bank of the UAE guideline says to use the dirham sign or the code AED, never both, because the price then names the currency twice.',
  fix: 'Keep the sign or the code AED, not both.',
  check: (m) => m.texts
    .filter((t) => t.text.includes('\u20C3') && AED_CODE.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" has the dirham sign and AED together.` })),
})

export const labelLanguage = defineRule({
  id: 'content/label-language', group: 'content', severity: 'note',
  title: 'A label in a different language from its element',
  why: 'The HTML lang attribute applies to the element\'s text attributes too, so the label is declared to be in the element\'s language, and screen readers that switch voice by language read it with the wrong pronunciation.',
  fix: 'Put lang on the element to match the label, or write the label in the language of the element.',
  // Facts section 4: lang covers text-bearing attributes (HTML Standard), and screen readers use the language of the text
  // (WCAG 3.1.2). Reading an aria-label that way is derived, and some readers ignore language in names, hence a note.
  // Only labels with no word in the other script count, so "ادفع عبر Apple Pay" and one-word brands stay quiet.
  check: (m) => m.labels.flatMap((l) => {
    if (l.lang === null) return []
    const latinInArabic = isArabicScriptLang(l.lang) && latinWordCount(l.text) >= 2 && arabicWordCount(l.text) === 0
    const arabicInOther = !isArabicScriptLang(l.lang) && arabicWordCount(l.text) >= 2 && latinWordCount(l.text) === 0
    return latinInArabic || arabicInOther ? [{ node: pick(l), message: `The ${l.attr} "${excerpt(l.text)}" is read as ${l.lang}.` }] : []
  }),
})

export const latinPunctuation = defineRule({
  id: 'content/latin-punctuation', group: 'content', severity: 'warning',
  title: 'A Latin comma, semicolon or question mark in Arabic text',
  why: 'Arabic has its own ، ؛ and ؟. The Latin marks look different, sit differently against Arabic letters, and read as copied from an English template.',
  fix: 'Use ، for the comma, ؛ for the semicolon and ؟ for the question mark.',
  check: (m) => m.texts.flatMap((t) => {
    const marks = latinPunctuationMarks(t.text)
    return marks.length === 0 ? [] : [{ node: pick(t), message: `"${excerpt(t.text)}" uses ${[...new Set(marks)].join(' ')} where Arabic punctuation belongs.` }]
  }),
})

export const currencyOrder = defineRule({
  id: 'content/currency-order', group: 'content', severity: 'warning',
  title: 'An Arabic currency before its number',
  why: 'Arabic prices read number first, as in 2.50 د.إ or ٣٠٠ ريال. A currency abbreviation or word placed before the number follows the English order. An isolate such as <bdi> does not change the order a reader sees.',
  fix: 'Put the number first and the currency after it.',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && t.blockHasArabic)
    .flatMap((t) => {
      const found = currencyFirst(t.text)
      return found.length === 0 ? [] : [{ node: pick(t), message: `"${excerpt(t.text)}" puts the currency before the number.` }]
    }),
})

export const contentRules = [missingLang, missingDir, langMismatch, mixedDigits, placeholderText, oldRialSign, currencySignFont, dirhamSignWithCode, labelLanguage, latinPunctuation, currencyOrder]
