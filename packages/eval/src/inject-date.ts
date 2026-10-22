import { ARABIC, elementsOf, ownTexts, retag, textEdit } from './inject-html.js'
import { forcesLtr, isolates, scriptNames, unisolate } from './inject-isolation.js'
import { rulesOf, textBefore } from './inject-style.js'
import type { Finder } from './inject-text.js'

const DIGIT = '[0-9٠-٩]'
const INDIC = '٠١٢٣٤٥٦٧٨٩'
const toWestern = (s: string) => s.replace(/[٠-٩]/g, (c) => String(INDIC.indexOf(c)))
const toIndic = (s: string) => s.replace(/[0-9]/g, (c) => INDIC[Number(c)]!)

// Gregorian (Gulf and Levant names) and Hijri month names, longest first so "تشرين الأول" wins over "تشرين".
const MONTH_NUMBERS: Readonly<Record<string, number>> = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  'كانون الثاني': 1, 'شباط': 2, 'آذار': 3, 'نيسان': 4, 'أيار': 5, 'حزيران': 6, 'تموز': 7, 'آب': 8, 'أيلول': 9, 'تشرين الأول': 10, 'تشرين الثاني': 11, 'كانون الأول': 12,
  'محرم': 1, 'صفر': 2, 'ربيع الأول': 3, 'ربيع الآخر': 4, 'جمادى الأولى': 5, 'جمادى الآخرة': 6, 'رجب': 7, 'شعبان': 8, 'رمضان': 9, 'شوال': 10, 'ذو القعدة': 11, 'ذو الحجة': 12,
}
const MONTH_NAMES = Object.keys(MONTH_NUMBERS).sort((x, y) => y.length - x.length).join('|')
const NUMERIC = new RegExp(`(${DIGIT}{1,4})\\s?([/.\\-])\\s?(${DIGIT}{1,2})\\s?([/.\\-])\\s?(${DIGIT}{1,4})`)
const WORDED = new RegExp(`(${DIGIT}{1,2})\\s+(${MONTH_NAMES})\\s+(${DIGIT}{4})`)

type Found = { readonly text: string; readonly index: number; readonly parts: readonly string[]; readonly dashOnly: boolean }

/** The first real date in the text. A version number such as 4.2.0 has no 4-digit year and is not one. */
function findDate(raw: string): Found | null {
  const w = WORDED.exec(raw)
  if (w) return { text: w[0], index: w.index, parts: [w[1]!, String(MONTH_NUMBERS[w[2]!]).padStart(2, '0'), w[3]!], dashOnly: false }
  const n = NUMERIC.exec(raw)
  if (!n) return null
  const parts = [n[1]!, n[3]!, n[5]!]
  const num = parts.map((p) => Number(toWestern(p)))
  const yearAt = parts.findIndex((p) => p.length === 4)
  const rest = num.filter((_, i) => i !== yearAt)
  const valid = (yearAt === 0 || yearAt === 2) && rest.every((v) => v >= 1 && v <= 31) && rest.some((v) => v <= 12)
  return valid ? { text: n[0], index: n.index, parts, dashOnly: n[2] === '-' && n[4] === '-' } : null
}

type Strong = 'arabic' | 'latin' | 'none'

/** The type of the last strong letter in the text. Digits take it on. */
function lastStrong(text: string): Strong {
  const last = [...text].reverse().find((c) => ARABIC.test(c) || /[A-Za-zÀ-ɏ֐-׿]/.test(c))
  return last === undefined ? 'none' : ARABIC.test(last) ? 'arabic' : 'latin'
}

/**
 * Dash-joined digits become Arabic numbers in RTL text, and a dash does not join those, so the parts reorder.
 * After an Arabic letter, Western digits become Arabic numbers by themselves. With no letter before the date
 * they stay European and the date stays whole, so Arabic-Indic digits are used to get the same reorder.
 * A Latin letter before the date makes every digit European, so nothing can reorder.
 */
function rewrite(found: Found, before: Strong): string | null {
  if (before === 'latin') return null
  const joined = found.parts.map(toWestern).join('-')
  return before === 'arabic' ? joined : toIndic(joined)
}

/** Whether the source already reorders: dashes between digits that are Arabic numbers. */
function alreadyReorders(found: Found, before: Strong, isolated: boolean): boolean {
  if (!found.dashOnly || isolated) return false
  return before === 'arabic' || /[٠-٩]/.test(found.text)
}

export const dateOrder: Finder = (html, body) => {
  const rules = rulesOf(html)
  for (const el of elementsOf(body)) {
    if (forcesLtr(el, rules) || scriptNames(html, el)) continue
    for (const t of ownTexts(el)) {
      const found = findDate(t.rawText)
      if (!found) continue
      const before = lastStrong(textBefore(el, t, found.index, rules))
      const date = rewrite(found, before)
      if (date === null || alreadyReorders(found, before, isolates(el)) || (date === found.text && !isolates(el))) continue
      const edits = isolates(el) ? unisolate(html, el, 'date-order') : retag(html, el, 'date-order')
      return [...edits, textEdit(t, t.rawText.replace(found.text, date))]
    }
  }
  return null
}
