import {
  formatEmiratesId, formatHijri, formatIban, formatMoney, formatSaudiPhone, formatUaePhone, toArabicDigits,
  type Currency, type Locale, type Numerals,
} from '@dualkit/format'
import { digits, int, mulberry32, pickOne, seedFor, type Random } from './random'

// Valid Gulf sample data for text layers. Every value comes from, or is checked by, @dualkit/format. No personal names:
// Arabic name spellings wait for a co-author.

export const SAMPLE_KINDS = [
  'phone-ae', 'phone-sa', 'iban-ae', 'iban-sa', 'emirates-id', 'amount-aed', 'amount-sar', 'amount-kwd', 'date-gregorian', 'date-hijri',
] as const
export type SampleKind = (typeof SAMPLE_KINDS)[number]

export const SAMPLE_LABELS: Record<SampleKind, string> = {
  'phone-ae': 'UAE phone', 'phone-sa': 'Saudi phone', 'iban-ae': 'UAE IBAN', 'iban-sa': 'Saudi IBAN', 'emirates-id': 'Emirates ID',
  'amount-aed': 'Amount in AED', 'amount-sar': 'Amount in SAR', 'amount-kwd': 'Amount in KWD',
  'date-gregorian': 'Gregorian date', 'date-hijri': 'Hijri date',
}

export type SampleStyle = { readonly locale: Locale; readonly numerals: Numerals }
export type FillOptions = SampleStyle & { readonly seed: number; readonly kind: SampleKind | 'auto' }
export type FillLayer = { readonly id: string; readonly name: string }
export type FillItem = { readonly id: string; readonly kind: SampleKind; readonly text: string }

const UAE_MOBILE = ['50', '52', '54', '55', '56', '58'] as const
const SAUDI_MOBILE = ['50', '51', '53', '54', '55', '56', '57', '58', '59'] as const
const DAY_MS = 86_400_000
/** Dates fall between 1 Jan 2025 and 31 Dec 2027, at noon UTC so the calendar day is the same across the Gulf. */
const FIRST_DAY = Date.UTC(2025, 0, 1, 12)
const DAYS = 3 * 365
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const withNumerals = (s: string, numerals: Numerals): string => (numerals === 'arab' ? toArabicDigits(s) : s)

/** A format function returned null for a value this module built: a bug here, never bad input. */
function required(value: string | null, kind: SampleKind): string {
  if (value === null) throw new Error(`The ${kind} sample did not pass @dualkit/format validation`)
  return value
}

/** ISO 13616 check digits for a country code and BBAN. */
function ibanCheckDigits(country: string, bban: string): string {
  let remainder = 0
  for (const ch of `${bban}${country}00`) {
    const value = Number.parseInt(ch, 36)
    remainder = (value > 9 ? remainder * 100 + value : remainder * 10 + value) % 97
  }
  return String(98 - remainder).padStart(2, '0')
}

function iban(rng: Random, country: 'AE' | 'SA'): string {
  const bban = country === 'AE' ? digits(rng, 19) : digits(rng, 20)
  return `${country}${ibanCheckDigits(country, bban)}${bban}`
}

/** The Luhn check digit for a number string. */
function luhnDigit(body: string): string {
  let sum = 0
  ;[...body].reverse().forEach((ch, i) => {
    const d = Number(ch) * (i % 2 === 0 ? 2 : 1)
    sum += d > 9 ? d - 9 : d
  })
  return String((10 - (sum % 10)) % 10)
}

function emiratesId(rng: Random): string {
  const body = `784${int(rng, 1970, 2005)}${digits(rng, 7)}`
  return `${body}${luhnDigit(body)}`
}

const MINOR: Record<Currency, number> = { AED: 100, SAR: 100, QAR: 100, KWD: 1000, BHD: 1000, OMR: 1000 }

function amount(rng: Random, currency: Currency, style: SampleStyle): string {
  const minor = int(rng, 5 * MINOR[currency], 25_000 * MINOR[currency])
  return formatMoney(minor / MINOR[currency], { currency, locale: style.locale, numerals: style.numerals })
}

const day = (rng: Random): Date => new Date(FIRST_DAY + int(rng, 0, DAYS) * DAY_MS)
const pad = (n: number): string => String(n).padStart(2, '0')

function gregorian(date: Date, style: SampleStyle): string {
  const [d, m, y] = [date.getUTCDate(), date.getUTCMonth(), date.getUTCFullYear()]
  // Arabic Gregorian month names differ across the region, so Arabic layers get the numeric form until a co-author picks names.
  if (style.locale === 'ar') return withNumerals(`${pad(d)}/${pad(m + 1)}/${y}`, style.numerals)
  return withNumerals(`${d} ${MONTHS_EN[m]} ${y}`, style.numerals)
}

type Generator = (rng: Random, style: SampleStyle) => string

const GENERATORS: Record<SampleKind, Generator> = {
  'phone-ae': (rng, s) => withNumerals(required(formatUaePhone(`0${pickOne(rng, UAE_MOBILE)}${digits(rng, 7)}`), 'phone-ae'), s.numerals),
  'phone-sa': (rng, s) => withNumerals(required(formatSaudiPhone(`0${pickOne(rng, SAUDI_MOBILE)}${digits(rng, 7)}`), 'phone-sa'), s.numerals),
  'iban-ae': (rng, s) => withNumerals(required(formatIban(iban(rng, 'AE')), 'iban-ae'), s.numerals),
  'iban-sa': (rng, s) => withNumerals(required(formatIban(iban(rng, 'SA')), 'iban-sa'), s.numerals),
  'emirates-id': (rng, s) => withNumerals(required(formatEmiratesId(emiratesId(rng)), 'emirates-id'), s.numerals),
  'amount-aed': (rng, s) => amount(rng, 'AED', s),
  'amount-sar': (rng, s) => amount(rng, 'SAR', s),
  'amount-kwd': (rng, s) => amount(rng, 'KWD', s),
  'date-gregorian': (rng, s) => gregorian(day(rng), s),
  // Umm al-Qura is the Saudi calendar, so the Hijri day is read in Riyadh.
  'date-hijri': (rng, s) => formatHijri(day(rng), { timeZone: 'Asia/Riyadh', locale: s.locale, numerals: s.numerals }),
}

/** One sample of a kind. The same kind, seed and style always give the same text. */
export const sample = (kind: SampleKind, seed: number, style: SampleStyle): string => GENERATORS[kind](mulberry32(seed), style)

const SAUDI = /saudi|ksa|\bsa\b|\bsar\b|riyal|966|سعود/i
const KUWAIT = /kuwait|\bkwd\b|dinar|كويت|دينار/i
const NAME_RULES: ReadonlyArray<[RegExp, (name: string) => SampleKind]> = [
  [/iban|آيبان|ايبان/i, (n) => (SAUDI.test(n) ? 'iban-sa' : 'iban-ae')],
  [/emirates|\beid\b|national id|id number|هوية/i, () => 'emirates-id'],
  [/phone|mobile|\btel\b|هاتف|جوال/i, (n) => (SAUDI.test(n) ? 'phone-sa' : 'phone-ae')],
  [/amount|price|total|balance|cost|fee|مبلغ|سعر|إجمالي|رصيد/i, (n) => (KUWAIT.test(n) ? 'amount-kwd' : SAUDI.test(n) ? 'amount-sar' : 'amount-aed')],
  [/hijri|هجري/i, () => 'date-hijri'],
  [/date|تاريخ/i, () => 'date-gregorian'],
]

/** The sample kind a layer's name asks for, such as "Phone" or "IBAN", or null when the name says nothing. */
export function kindForLayerName(name: string): SampleKind | null {
  const rule = NAME_RULES.find(([pattern]) => pattern.test(name))
  return rule ? rule[1](name) : null
}

/** Text for each layer. Layers whose names name no kind take the kinds in turn. */
export function fillPlan(layers: readonly FillLayer[], options: FillOptions): FillItem[] {
  let unnamed = 0
  return layers.map((layer, index) => {
    const named = options.kind === 'auto' ? kindForLayerName(layer.name) : options.kind
    const kind = named ?? SAMPLE_KINDS[unnamed++ % SAMPLE_KINDS.length]!
    return { id: layer.id, kind, text: sample(kind, seedFor(options.seed, index), options) }
  })
}
