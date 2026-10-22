import type { HTMLElement } from 'node-html-parser'
import {
  ARABIC,
  addStyle,
  elementsOf,
  hasElementChild,
  isText,
  ownTexts,
  removeAttr,
  removeStyleDecl,
  retag,
  tagOf,
  textEdit,
  type Edit,
} from './inject-html.js'

/** Finds the first fitting element and returns the edits for it, or null. */
export type Finder = (html: string, body: HTMLElement) => readonly Edit[] | null

const DIGIT = '[0-9\u0660-\u0669]'
const WEST: Readonly<Record<string, string>> = Object.fromEntries([...'\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'].map((c, i) => [c, String(i)]))
const toWestern = (s: string) => s.replace(/[\u0660-\u0669]/g, (c) => WEST[c] ?? c)
const DATE = new RegExp(`${DIGIT}{1,4}\\s?[/.\\-]\\s?${DIGIT}{1,2}\\s?[/.\\-]\\s?${DIGIT}{1,4}`)
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WORDED_DATE = new RegExp(`(${DIGIT}{1,2})\\s+(${MONTHS.join('|')})\\s+(${DIGIT}{4})`)
/** Where the weak characters sit decides whether an unisolated number visibly reorders. */
const REORDERS = /[+\-\u2212/:\s]/
const NUMBERISH = /^[\s\u200e\u200f]*[+\-\u2212]?[0-9\u0660-\u0669][0-9\u0660-\u0669\s,.\u066c\u066b:/\-+()]*$/

const isolates = (el: HTMLElement) =>
  tagOf(el) === 'bdi' || el.hasAttribute('dir') || /unicode-bidi\s*:\s*(isolate|embed|plaintext)/i.test(el.getAttribute('style') ?? '')

/** Opening-tag edit that takes the isolation off an element. A bdi becomes a span so the marker has a home. */
function unisolate(html: string, el: HTMLElement, kind: string): readonly Edit[] {
  const transform = (rest: string) => removeStyleDecl(removeAttr(rest, 'dir'), 'unicode-bidi')
  return tagOf(el) === 'bdi' ? retag(html, el, kind, { tag: 'span', transform }) : retag(html, el, kind, { transform })
}

const arabicAround = (el: HTMLElement) => ARABIC.test(el.parentNode?.textContent ?? el.textContent)

/** The date as digits joined by dashes, month names turned into their number. */
function westernDate(m: RegExpExecArray): string {
  if (m[2] !== undefined && MONTHS.includes(m[2])) {
    return [toWestern(m[1]!), String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0'), toWestern(m[3]!)].join('-')
  }
  return toWestern(m[0]).replace(/\s?[/.]\s?/g, '-').replace(/\s?-\s?/g, '-')
}

export const dateOrder: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    for (const t of ownTexts(el)) {
      const m = DATE.exec(t.rawText) ?? WORDED_DATE.exec(t.rawText)
      if (!m || !ARABIC.test(el.textContent)) continue
      const date = westernDate(m)
      const edits = isolates(el) ? unisolate(html, el, 'date-order') : retag(html, el, 'date-order')
      if (date === m[0] && !isolates(el)) continue
      return [...edits, textEdit(t, t.rawText.replace(m[0], date))]
    }
  }
  return null
}

export const numberIsolation: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    if (!isolates(el) || hasElementChild(el) || !NUMBERISH.test(el.textContent) || !REORDERS.test(el.textContent.trim()) || !arabicAround(el)) continue
    return unisolate(html, el, 'number-isolation')
  }
  return null
}

const CURRENCIES = ['SAR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'USD', 'ر.س', 'ر.ع', 'ر.ق', 'د.إ', 'د.ك', 'د.ب', 'ج.م', 'ريال', 'درهم', 'دينار', 'جنيه', '﷼', '$', '€', '£']
const CUR = CURRENCIES.map((c) => (/^[A-Z]+$/.test(c) ? `(?<![A-Za-z])${c}(?![A-Za-z])` : c.replace(/[.$]/g, '\\$&'))).join('|')
const NUM = `${DIGIT}(?:[0-9\u0660-\u0669,\u066c.\u066b]*${DIGIT})?`
const SEP = '(?:\\s|&nbsp;|&#160;|\\u00a0)*'
const AMOUNT = new RegExp(`(?<n1>${NUM})(?<s1>${SEP})(?<c1>${CUR})|(?<c2>${CUR})(?<s2>${SEP})(?<n2>${NUM})`)

function swapCurrency(m: RegExpExecArray): string {
  const g = m.groups!
  const [num, cur, sep] = g.n1 !== undefined ? [g.n1, g.c1!, g.s1!] : [g.n2!, g.c2!, g.s2!]
  const gap = sep === '' && /[^$€£﷼]/.test(cur) ? ' ' : sep
  return g.n1 !== undefined ? `${cur}${gap}${num}` : `${num}${gap}${cur}`
}

export const currencySide: Finder = (html, body) => {
  for (const el of elementsOf(body)) {
    for (const t of ownTexts(el)) {
      const m = AMOUNT.exec(t.rawText)
      if (m) return [...retag(html, el, 'currency-side'), textEdit(t, t.rawText.replace(m[0], swapCurrency(m)))]
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
    if (!ownTexts(el).some((t) => (t.rawText.match(/[\u0600-\u06FF]/g) ?? []).length >= 3)) continue
    return retag(html, el, 'arabic-tracking', { transform: (rest) => addStyle(rest, 'letter-spacing: 0.08em;') })
  }
  return null
}
