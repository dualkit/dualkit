// Live data for the kit previews: the Format lines are parsed by @dualkit/format and the Check families are counted from
// @dualkit/rules, so no number in a preview is typed by hand. Server-side only (the menu gets the rendered previews).
import { formatHijri, formatMoney, formatUaePhone, toWesternDigits, type Currency } from '@dualkit/format'
import { RULES, type Group } from '@dualkit/rules'
import { V3 } from './copy'

const CURRENCIES: readonly Currency[] = ['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR']
/** Display-only marks: bidi isolates and directional marks the preview adds so Arabic-Indic groups keep their order. */
const MARKS = /[‎‏⁦-⁩]/g
const plain = (s: string) => s.replace(MARKS, '').replace(/\s+/g, ' ').trim()
const ARABIC_NUMBER = /[٠-٩][٠-٩٬٫]*/

/** "١٬٢٣٤٫٥٠ د.إ" to "1234.50 AED": the currency is the one whose Arabic formatting gives back exactly what was typed. */
export function parseMoney(typed: string): string | null {
  const digits = ARABIC_NUMBER.exec(typed)?.[0]
  if (!digits) return null
  const western = toWesternDigits(digits).replace(/,/g, '')
  const amount = Number(western)
  if (!Number.isFinite(amount)) return null
  const currency = CURRENCIES.find((c) => plain(formatMoney(amount, { currency: c, locale: 'ar', numerals: 'arab' })) === plain(typed))
  return currency ? `${western} ${currency}` : null
}

const HIJRI_EPOCH = Date.UTC(622, 6, 16)
const HIJRI_YEAR_DAYS = 354.367
const DAY_MS = 86_400_000
const GULF_TZ = 'Asia/Dubai'

/** "١ رمضان ١٤٤٧" to "2026-02-18": walks the Gregorian days of that Hijri year until formatHijri gives the typed date back. */
export function parseHijri(typed: string): string | null {
  const year = Number(toWesternDigits(plain(typed)).split(' ').at(-1))
  if (!Number.isInteger(year) || year < 1) return null
  const want = `${plain(typed)} هـ`
  const start = HIJRI_EPOCH + Math.floor((year - 1) * HIJRI_YEAR_DAYS - 10) * DAY_MS
  for (let k = 0; k < 380; k += 1) {
    const day = new Date(start + k * DAY_MS + DAY_MS / 2)
    if (formatHijri(day, { locale: 'ar', numerals: 'arab', timeZone: GULF_TZ }) === want) return day.toISOString().slice(0, 10)
  }
  return null
}

export const parsePhone = (typed: string): string | null => formatUaePhone(plain(typed), { style: 'international' })

const PARSERS: Record<string, (typed: string) => string | null> = { Money: parseMoney, 'Hijri date': parseHijri, Phone: parsePhone }

export type FormatLine = { what: string; ar: string; out: string }

/** The approved Format preview lines with their results computed now. A line the library cannot read throws at build. */
export function parsedFormatLines(): FormatLine[] {
  return V3.kit.previews.format.lines.map(({ what, ar }) => {
    const out = PARSERS[what]?.(ar)
    if (!out) throw new Error(`@dualkit/format could not read the ${what} preview line`)
    return { what, ar, out }
  })
}

const FAMILY_NAMES: Record<Group, string> = { bidi: 'Bidi', layout: 'Layout', icons: 'Icons', type: 'Type', content: 'Content' }

/** Rules per family, in the order the copy lists them. */
export function checkFamilies(): Array<[string, number]> {
  const order: Group[] = ['bidi', 'layout', 'icons', 'type', 'content']
  return order.map((g) => [FAMILY_NAMES[g], RULES.filter((r) => r.group === g).length])
}

export const ruleCount = (): number => RULES.length
