import type { Locale } from './money'
import { applyNumerals, type Numerals } from './numerals'

export type HijriDate = { readonly year: number; readonly month: number; readonly day: number }
export type HijriOptions = { readonly timeZone?: string }
export type FormatHijriOptions = HijriOptions & { readonly locale?: Locale; readonly numerals?: Numerals }

const CALENDAR = 'islamic-umalqura'

const MONTHS: Record<Locale, readonly string[]> = {
  en: [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani',
    'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah',
  ],
  ar: [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
  ],
}
const ERA: Record<Locale, string> = { en: 'AH', ar: 'هـ' }

/** The Umm al-Qura date for a moment, on the calendar day of the given time zone. */
export function toHijri(date: Date, options: HijriOptions = {}): HijriDate {
  if (Number.isNaN(date.getTime())) throw new RangeError('toHijri needs a valid date')
  const formatter = new Intl.DateTimeFormat(`en-u-ca-${CALENDAR}-nu-latn`, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  })
  if (formatter.resolvedOptions().calendar !== CALENDAR) {
    throw new Error(`This runtime has no ${CALENDAR} calendar, so Hijri dates cannot be computed`)
  }
  const part = (type: string) => Number(formatter.formatToParts(date).find((p) => p.type === type)?.value)
  return { year: part('year'), month: part('month'), day: part('day') }
}

/** "1 Ramadan 1447 AH" or "1 رمضان 1447 هـ". */
export function formatHijri(date: Date, options: FormatHijriOptions = {}): string {
  const { locale = 'en', numerals = 'latn' } = options
  const { year, month, day } = toHijri(date, options)
  const text = `${day} ${MONTHS[locale][month - 1]} ${year} ${ERA[locale]}`
  return applyNumerals(text, numerals)
}
