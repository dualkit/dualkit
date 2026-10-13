import { applyNumerals, type Numerals } from './numerals'

export type Currency = 'AED' | 'SAR'
export type Locale = 'en' | 'ar'

export type MoneyOptions = {
  readonly currency: Currency
  readonly locale?: Locale
  readonly numerals?: Numerals
  readonly fractionDigits?: number
}

const ARABIC_ABBREVIATION: Record<Currency, string> = { AED: 'د.إ', SAR: 'ر.س' }
const NBSP = ' '
const LRI = '⁦'
const PDI = '⁩'

/**
 * Formats an amount the same way in every browser. The grouping comes from en-US,
 * which every Intl build ships, so no runtime picks its own Arabic locale data.
 */
export function formatMoney(amount: number, options: MoneyOptions): string {
  if (!Number.isFinite(amount)) throw new RangeError(`formatMoney needs a finite amount, got ${amount}`)
  const { currency, locale = 'en', numerals = 'latn', fractionDigits = 2 } = options
  const digits = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(amount))
  const negative = amount < 0 && digits.replace(/[0.,]/g, '') !== ''
  const number = applyNumerals(digits, numerals)

  if (locale === 'en') return `${negative ? '-' : ''}${currency}${NBSP}${number}`
  const signed = negative ? `${LRI}-${number}${PDI}` : number
  return `${signed}${NBSP}${ARABIC_ABBREVIATION[currency]}`
}
