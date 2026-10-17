import type { TextRun } from '../model'
import { defineRule, pick } from '../rule'
import { ARABIC_INDIC_DIGIT, PLACEHOLDER, WESTERN_DIGIT, arabicShare, excerpt, isArabicScriptLang } from '../text'


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

export const contentRules = [missingLang, missingDir, langMismatch, mixedDigits, placeholderText]
