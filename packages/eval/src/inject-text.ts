import type { HTMLElement } from 'node-html-parser'
import { isolates, scriptNames, unisolate } from './inject-isolation.js'
import { rulesOf, textAround } from './inject-style.js'
import {
  ARABIC,
  addStyle,
  elementsOf,
  hasElementChild,
  isText,
  ownTexts,
  retag,
  tagOf,
  textEdit,
  type Edit,
} from './inject-html.js'

/** Finds the first fitting element and returns the edits for it, or null. */
export type Finder = (html: string, body: HTMLElement) => readonly Edit[] | null

const DIGIT = '[0-9\u0660-\u0669]'
/** Where the weak characters sit decides whether an unisolated number visibly reorders. */
const REORDERS = /[+\-\u2212/:\s]/
const NUMBERISH = /^[\s\u200e\u200f]*[+\-\u2212]?[0-9\u0660-\u0669][0-9\u0660-\u0669\s,.\u066c\u066b:/\-+()]*$/

export const numberIsolation: Finder = (html, body) => {
  const rules = rulesOf(html)
  for (const el of elementsOf(body)) {
    if (!isolates(el) || hasElementChild(el) || !NUMBERISH.test(el.textContent) || !REORDERS.test(el.textContent.trim())) continue
    // The number must sit inline with Arabic words. In a flex row or its own block there is nothing to reorder against.
    if (!ARABIC.test(textAround(el, rules)) || scriptNames(html, el)) continue
    return unisolate(html, el, 'number-isolation')
  }
  return null
}

const CURRENCIES = ['SAR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'USD', 'ر.س', 'ر.ع', 'ر.ق', 'د.إ', 'د.ك', 'د.ب', 'ج.م', 'ريال', 'درهم', 'دينار', 'جنيه', '﷼', '$', '€', '£']
const CUR = CURRENCIES.map((c) => (/^[A-Z]+$/.test(c) ? `(?<![A-Za-z])${c}(?![A-Za-z])` : c.replace(/[.$]/g, '\\$&'))).join('|')
const NUM = `${DIGIT}(?:[0-9\u0660-\u0669,\u066c.\u066b]*${DIGIT})?`
const SEP = '(?:\\s|&nbsp;|&#160;|\\u00a0)*'
// Arabic text puts the currency after the number, so only that order is moved: it is the correct one.
const AMOUNT = new RegExp(`(?<n>${NUM})(?<s>${SEP})(?<c>${CUR})`)

function swapCurrency(m: RegExpExecArray): string {
  const { n, s, c } = m.groups as { n: string; s: string; c: string }
  return `${c}${s === '' && !/^[$€£﷼]$/.test(c) ? ' ' : s}${n}`
}

export const currencySide: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    for (const t of ownTexts(el)) {
      const m = AMOUNT.exec(t.rawText)
      if (m && ARABIC.test(el.textContent)) return [...retag(html, el, 'currency-side'), textEdit(t, t.rawText.replace(m[0], swapCurrency(m)))]
    }
  }
  return null
}

const LATIN: Readonly<Record<string, string>> = { '،': ',', '؛': ';', '؟': '?' }

export const latinPunctuation: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    for (const t of ownTexts(el)) {
      if (!ARABIC.test(t.rawText) || !/[،؛؟]/.test(t.rawText)) continue
      return [...retag(html, el, 'latin-punctuation'), textEdit(t, t.rawText.replace(/[،؛؟]/g, (c) => LATIN[c] ?? c))]
    }
  }
  return null
}

const INLINE = new Set(['span', 'a', 'label', 'small', 'b', 'i', 'em', 'strong'])
const LABEL_SKIP = new Set(['html', 'body', 'option', 'select', 'pre', 'code'])
const CUT = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 3em;'

export const cutLabel: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    const text = el.textContent.trim()
    const short = text.length >= 7 && text.length <= 32 && ARABIC.test(text)
    if (hasElementChild(el) || LABEL_SKIP.has(tagOf(el)) || !short || !el.childNodes.some(isText)) continue
    // An inline box ignores max-width, so give it one that does.
    const decls = INLINE.has(tagOf(el)) ? `${CUT} display: inline-block;` : CUT
    return retag(html, el, 'cut-label', { transform: (rest) => addStyle(rest, decls) })
  }
  return null
}

export const arabicTracking: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    if (!ownTexts(el).some((t) => (t.rawText.match(/[\u0621-\u064A\u0671-\u06D3]/g) ?? []).length >= 3)) continue
    return retag(html, el, 'arabic-tracking', { transform: (rest) => addStyle(rest, 'letter-spacing: 0.08em;') })
  }
  return null
}
