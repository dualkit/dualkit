import type { Node } from '@babel/types'
import { staticLocales, staticObject, staticString, unwrap, visit } from '../ast'
import type { LintHit, LintRule, SourceFile } from '../types'

const JS_LANGS = ['js', 'jsx', 'ts', 'tsx', 'html'] as const

type Kind = 'number' | 'date' | 'either'
type IntlCall = {
  start: number
  kind: Kind
  /** Static locales, or null when the argument is a variable, a spread or built at runtime. */
  locales: string[] | null
  localeArg: Node | null
  /** The options object by key. null when it is not a plain literal; an empty map when none is passed. */
  options: Map<string, Node> | null
}

const TO_LOCALE: Readonly<Record<string, Kind>> = { toLocaleString: 'either', toLocaleDateString: 'date', toLocaleTimeString: 'date' } as const satisfies Record<string, Kind>
const INTL_CTORS: Readonly<Record<string, Kind>> = { NumberFormat: 'number', DateTimeFormat: 'date' } as const satisfies Record<string, Kind>

const isUndefined = (n: Node | null): boolean => n === null || (n.type === 'Identifier' && n.name === 'undefined')

function optionsOf(node: Node | undefined): Map<string, Node> | null {
  const n = unwrap(node)
  if (!n || isUndefined(n)) return new Map()
  return staticObject(n)
}

/** The Intl call at node, or null. Only the shapes named in the docs are recognised. */
function intlCall(node: Node, base: number): IntlCall | null {
  if (node.type !== 'CallExpression' && node.type !== 'NewExpression' && node.type !== 'OptionalCallExpression') return null
  const callee = node.callee
  if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') return null
  if (callee.computed || callee.property.type !== 'Identifier' || node.start == null) return null
  const name = callee.property.name
  let kind: Kind | undefined
  if (callee.object.type === 'Identifier' && callee.object.name === 'Intl') kind = INTL_CTORS[name]
  else if (node.type !== 'NewExpression') kind = TO_LOCALE[name]
  if (!kind) return null
  const [first, second] = node.arguments
  const localeArg = unwrap(first as Node | undefined)
  return { start: base + node.start, kind, localeArg: isUndefined(localeArg) ? null : localeArg, locales: staticLocales(first as Node | undefined), options: optionsOf(second as Node | undefined) }
}

function eachIntlCall(file: SourceFile, fn: (call: IntlCall) => void): void {
  for (const block of file.js) {
    visit(block.ast.program, (node) => {
      const call = intlCall(node, block.offset)
      if (call) fn(call)
    })
  }
}

const isArabic = (locale: string): boolean => /^ar(-|$)/i.test(locale)

/** The keywords of the -u- extension of a locale tag, in lower case. A keyword with no value maps to ''. */
export function unicodeKeywords(locale: string): Map<string, string> {
  const out = new Map<string, string>()
  const parts = locale.toLowerCase().split('-')
  const u = parts.indexOf('u')
  if (u === -1) return out
  let key: string | null = null
  for (const part of parts.slice(u + 1)) {
    if (part.length === 1) break
    if (part.length === 2) {
      key = part
      out.set(key, '')
    } else if (key !== null) {
      out.set(key, out.get(key) ? `${out.get(key)}-${part}` : part)
    }
  }
  return out
}

/**
 * The calendar the call asks for, as a lower case id. The option wins over the -u-ca- extension of the first
 * locale. null means no calendar is asked for or it cannot be known.
 */
function calendarOf(call: IntlCall): string | null {
  if (call.options === null) return null
  const option = call.options.get('calendar')
  if (option) return staticString(option)?.toLowerCase() ?? null
  const first = call.locales?.[0]
  return first === undefined ? null : unicodeKeywords(first).get('ca') || null
}

const DATE_KINDS: ReadonlySet<Kind> = new Set(['date', 'either'])

/** Date fields that print words, never digits. month counts only with a word style. */
const TEXT_FIELDS: ReadonlySet<string> = new Set(['weekday', 'era', 'dayPeriod', 'timeZoneName'])
const TEXT_MONTHS: ReadonlySet<string> = new Set(['long', 'short', 'narrow'])
const NUMERIC_FIELDS: ReadonlySet<string> = new Set(['year', 'day', 'hour', 'minute', 'second', 'fractionalSecondDigits', 'dateStyle', 'timeStyle'])

/** A date format whose static options ask only for text fields, so it prints no digits. No options means the default, which has digits. */
function textOnlyDate(call: IntlCall): boolean {
  if (!DATE_KINDS.has(call.kind) || call.options === null) return false
  let text = false
  for (const [key, value] of call.options) {
    if (NUMERIC_FIELDS.has(key)) return false
    if (key === 'month') {
      const style = staticString(value)
      if (style === null || !TEXT_MONTHS.has(style)) return false
      text = true
    } else if (TEXT_FIELDS.has(key)) text = true
  }
  return text
}

/** A tag with a region subtag, such as ar-SA or ar-Arab-AE, as opposed to bare ar. */
function hasRegion(locale: string): boolean {
  for (const part of locale.split('-').slice(1)) {
    if (part.length === 1) return false
    if (/^(?:[a-z]{2}|\d{3})$/i.test(part)) return true
  }
  return false
}

const digitsMessage = (locale: string): string =>
  hasRegion(locale)
    ? `The locale '${locale}' has no numberingSystem and no -u-nu- extension. The default digits differ between Arabic locales (for example ar-SA prints Arabic-Indic and ar-AE prints Latin), so pin numberingSystem to say which you mean.`
    : `The locale '${locale}' has no numberingSystem and no -u-nu- extension, and the default digits for bare ar changed from Arabic-Indic to Latin from CLDR 45 to 46, so they vary by runtime.`
const BARE_ISLAMIC = 'islamic'

export const INTL_RULES: readonly LintRule[] = [
  {
    id: 'source/intl-digits',
    severity: 'warning',
    title: 'Digits left to the runtime',
    why: "The default digits for Arabic locales come from the runtime's CLDR data. CLDR changed bare ar from Arabic-Indic to Latin digits between releases 45 and 46 (Node 18 prints Arabic-Indic, Node 20 and later print Latin), so the same code shows different digits on different machines. Regional tags differ from each other too: ar-SA and ar-EG default to Arabic-Indic, ar-AE and ar-MA to Latin.",
    fix: 'Pin numberingSystem, or add a -u-nu- extension to the locale, set to latn or arab.',
    langs: JS_LANGS,
    check: (file) => {
      const hits: LintHit[] = []
      eachIntlCall(file, (call) => {
        const first = call.locales?.[0]
        if (first === undefined || !isArabic(first) || call.options === null) return
        if (call.options.has('numberingSystem') || unicodeKeywords(first).has('nu') || textOnlyDate(call)) return
        hits.push({ offset: call.start, message: digitsMessage(first) })
      })
      return hits
    },
  },
  {
    id: 'source/islamic-calendar',
    severity: 'warning',
    title: 'Bare islamic calendar',
    why: 'CLDR ranks islamic-umalqura first among the Hijri calendars for Saudi Arabia, the UAE, Bahrain, Kuwait and Qatar, and the bare islamic calendar is a different calculation, so the same day can print a different Hijri date.',
    fix: 'Use islamic-umalqura, as calendar: "islamic-umalqura" or -u-ca-islamic-umalqura in the locale.',
    langs: JS_LANGS,
    check: (file) => {
      const hits: LintHit[] = []
      eachIntlCall(file, (call) => {
        if (!DATE_KINDS.has(call.kind) || calendarOf(call) !== BARE_ISLAMIC) return
        hits.push({ offset: call.start, message: 'The calendar is the bare islamic, a different calculation from islamic-umalqura, so the Hijri date can differ.' })
      })
      return hits
    },
  },
  {
    id: 'source/hijri-time-zone',
    severity: 'warning',
    title: 'Hijri date without a time zone',
    why: "Without timeZone, Intl uses the time zone of the machine it runs on, and the same instant can fall on a different Hijri day in another zone, so a server elsewhere can show yesterday's or tomorrow's date.",
    fix: 'Pass a timeZone such as Asia/Riyadh or Asia/Dubai.',
    langs: JS_LANGS,
    check: (file) => {
      const hits: LintHit[] = []
      eachIntlCall(file, (call) => {
        if (!DATE_KINDS.has(call.kind) || call.options === null || call.options.has('timeZone')) return
        if (!calendarOf(call)?.startsWith(BARE_ISLAMIC)) return
        hits.push({ offset: call.start, message: 'An Islamic calendar is used with no timeZone, so the date follows the time zone of the machine that runs it.' })
      })
      return hits
    },
  },
]
