const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DECIMAL = '٫'
const ARABIC_GROUPING = '٬'

export type Numerals = 'latn' | 'arab'

/** 1,234.50 or 1234.5: grouped in threes, at most one decimal point. Dates, lists and versions are not. */
const NUMBER_TOKEN = /^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/

const numberToText = (value: number): string =>
  Number.isFinite(value)
    ? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
    : String(value)

const arabicSeparators = (token: string): string =>
  NUMBER_TOKEN.test(token)
    ? token.replace(/[.,]/g, (sep) => (sep === '.' ? ARABIC_DECIMAL : ARABIC_GROUPING))
    : token

/** Western digits to Arabic-Indic. Separators change only inside something that reads as one number. */
export function toArabicDigits(input: string | number): string {
  const text = typeof input === 'number' ? numberToText(input) : input
  return text
    .replace(/\d[\d.,]*\d/g, arabicSeparators)
    .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)] ?? d)
}

/** Arabic-Indic and Persian digits, and the Arabic separators, to their Western forms. */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹٫٬]/g, (ch) => {
    if (ch === ARABIC_DECIMAL) return '.'
    if (ch === ARABIC_GROUPING) return ','
    const arabic = ARABIC_INDIC.indexOf(ch)
    return String(arabic >= 0 ? arabic : PERSIAN.indexOf(ch))
  })
}

export const applyNumerals = (text: string, numerals: Numerals): string =>
  numerals === 'arab' ? toArabicDigits(text) : text
