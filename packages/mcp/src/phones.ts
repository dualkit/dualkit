import {
  formatBahrainPhone, formatKuwaitPhone, formatOmanPhone, formatQatarPhone, formatSaudiPhone, formatUaePhone,
  parseBahrainPhone, parseKuwaitPhone, parseOmanPhone, parseQatarPhone, parseSaudiPhone, parseUaePhone,
  type GulfCountry, type Result,
} from '@dualkit/format'

export type PhoneStyle = 'national' | 'international' | 'e164'
export const PHONE_STYLES = ['national', 'international', 'e164'] as const
export const GULF_COUNTRIES = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'] as const satisfies readonly GulfCountry[]

type CountryPhone = {
  parse: (input: string) => Result<unknown, string>
  format: (input: string, options: { style?: PhoneStyle }) => string | null
}

/** Each country's own parser and formatter from @dualkit/format. */
export const PHONES: Record<GulfCountry, CountryPhone> = {
  AE: { parse: parseUaePhone, format: formatUaePhone },
  SA: { parse: parseSaudiPhone, format: formatSaudiPhone },
  QA: { parse: parseQatarPhone, format: formatQatarPhone },
  KW: { parse: parseKuwaitPhone, format: formatKuwaitPhone },
  BH: { parse: parseBahrainPhone, format: formatBahrainPhone },
  OM: { parse: parseOmanPhone, format: formatOmanPhone },
}
