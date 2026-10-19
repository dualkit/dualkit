// One live example per Gulf city for the map, rendered by @dualkit/format when the page is built (and revalidated), then
// passed to the client map as props. Nothing here is typed by hand: the inputs are made with the library's Arabic-Indic
// digits and every result is the library's own output. A city without an example, or an input the library cannot
// read, throws at build.
import { formatHijri, formatMoney, formatUaePhone, toArabicDigits, toWesternDigits, type Currency } from '@dualkit/format'

/** `from` is what someone types or has, `to` is what @dualkit/format gives back; `ar` marks an Arabic run. */
export type CityExample = { from: string; fromAr: boolean; to: string; toAr: boolean }

/** A typed amount in Arabic-Indic digits, read back and formatted with the currency's own minor units. */
function typedAmount(currency: Currency, amount: number): CityExample {
  const from = toArabicDigits(String(amount))
  const read = Number(toWesternDigits(from))
  if (!Number.isFinite(read)) throw new Error(`@dualkit/format could not read ${from}`)
  return { from, fromAr: true, to: formatMoney(read, { currency }), toAr: false }
}

const isoDay = (now: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

const EXAMPLES: Record<string, (now: Date) => CityExample> = {
  'Kuwait City': () => typedAmount('KWD', 1234.5),
  // Today in Riyadh on the Umm al-Qura calendar.
  Riyadh: (now) => ({ from: isoDay(now, 'Asia/Riyadh'), fromAr: false, to: formatHijri(now, { locale: 'ar', numerals: 'arab', timeZone: 'Asia/Riyadh' }), toAr: true }),
  Manama: () => typedAmount('BHD', 8.75),
  Doha: () => typedAmount('QAR', 150),
  'Abu Dhabi': () => ({ from: formatMoney(99.5, { currency: 'AED' }), fromAr: false, to: formatMoney(99.5, { currency: 'AED', locale: 'ar', numerals: 'arab' }), toAr: true }),
  Dubai: () => {
    const from = toArabicDigits('050 123 4567')
    const to = formatUaePhone(from, { style: 'international' })
    if (!to) throw new Error(`@dualkit/format could not read ${from}`)
    return { from, fromAr: true, to, toAr: false }
  },
  Muscat: () => typedAmount('OMR', 3.2),
}

/** Examples for the given cities, in their order. */
export function cityExamples(cities: readonly string[], now: Date = new Date()): Record<string, CityExample> {
  return Object.fromEntries(cities.map((name) => {
    const make = EXAMPLES[name]
    if (!make) throw new Error(`no @dualkit/format example for ${name}`)
    return [name, make(now)]
  }))
}

/** An Arabic run with Arabic letters reads right to left; one of digits only (a phone number) keeps left to right. */
export const runDir = (text: string): 'rtl' | 'ltr' => (/[ء-ي]/.test(text) ? 'rtl' : 'ltr')
