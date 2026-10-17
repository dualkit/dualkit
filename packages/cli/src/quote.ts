// Quoted page text inside a report message, rendered so it reads in the order its author typed it.
import { escapeHtml } from './escape'

const ARABIC_LETTER = /[\u0600-\u065F\u066A-\u06EF\u06FA-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/g
/**
 * Starts a left-to-right token: a Latin letter, a Western digit, or a leading plus. Arabic-Indic digit
 * groups are left alone: Chromium paints their first group on the right in every context, isolated or not.
 */
const LTR_START = '\\+?[A-Za-z0-9\\u00C0-\\u024F]'
/** Continues it up to the next space or Arabic letter, so emails, URLs and 050-123 stay whole. */
const LTR_REST = '[^\\s\\u0600-\\u065F\\u066A-\\u06EF\\u06FA-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]*'
/**
 * Neighbouring tokens joined by spaces form one run: isolated one by one, the groups of 050 123 4567
 * or the words of Customer Care would be laid out right to left.
 */
const LTR_RUN = new RegExp(`${LTR_START}${LTR_REST}(?:[ \\u00A0]+${LTR_START}${LTR_REST})*`, 'g')
const QUOTED = /"([^"]*)"/g

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

/** Right to left when most letters are Arabic; digits and symbols alone read left to right. */
export const quoteDirection = (s: string): 'ltr' | 'rtl' => (count(s, ARABIC_LETTER) > count(s, LATIN_LETTER) ? 'rtl' : 'ltr')

/** An excerpt in a <bdi> of its own direction, with each left-to-right run isolated left to right. */
export function renderExcerpt(s: string): string {
  let out = ''
  let last = 0
  for (const m of s.matchAll(LTR_RUN)) {
    out += `${escapeHtml(s.slice(last, m.index))}<bdi dir="ltr">${escapeHtml(m[0])}</bdi>`
    last = m.index + m[0].length
  }
  return `<bdi dir="${quoteDirection(s)}">${out}${escapeHtml(s.slice(last))}</bdi>`
}

/** A rule's plain message, escaped, with every "quoted" excerpt isolated. */
export function renderMessage(message: string): string {
  let out = ''
  let last = 0
  for (const m of message.matchAll(QUOTED)) {
    out += `${escapeHtml(message.slice(last, m.index))}&quot;${renderExcerpt(m[1]!)}&quot;`
    last = m.index + m[0].length
  }
  return out + escapeHtml(message.slice(last))
}
