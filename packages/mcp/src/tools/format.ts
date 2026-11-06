import { CURRENCIES, formatHijri, formatMoney, parseGulfPhone, toArabicDigits, toHijri, toWesternDigits, type GulfCountry } from '@dualkit/format'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { GULF_COUNTRIES, PHONES, PHONE_STYLES, type PhoneStyle } from '../phones'
import { failure, handle, lenient, oneOf, result, says, strictFor, text } from '../schema'

const KINDS = ['money', 'hijri', 'numerals', 'phone'] as const
const LOCALES = ['en', 'ar'] as const
const NUMERALS = ['latn', 'arab'] as const

const validTimeZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const field = {
  amount: z.number(says('amount', 'a number, such as 1234.5')).finite({ error: 'amount must be a finite number.' })
    .describe('money: the amount, such as 1234.5.'),
  currency: z.enum(CURRENCIES, says('currency', oneOf(CURRENCIES))).describe(`money: ${oneOf(CURRENCIES)}. KWD, BHD and OMR get three decimals.`),
  locale: z.enum(LOCALES, says('locale', 'en or ar')).describe('money and hijri: en or ar. Defaults to en.'),
  numerals: z.enum(NUMERALS, says('numerals', 'latn for 0-9 or arab for ٠-٩')).describe('money and hijri: latn for 0-9 or arab for ٠-٩. Defaults to latn.'),
  fractionDigits: z.int(says('fractionDigits', 'a whole number from 0 to 20')).min(0, { error: 'fractionDigits must be 0 or more.' })
    .max(20, { error: 'fractionDigits must be 20 or less.' }).describe('money: decimals to show. Defaults to the currency\'s own.'),
  date: text('date', 'an ISO date or date-time, such as 2026-02-18 or 2026-02-18T12:00:00Z')
    .refine((d) => !Number.isNaN(new Date(d).getTime()), { error: 'date must be an ISO date or date-time, such as 2026-02-18 or 2026-02-18T12:00:00Z.' })
    .describe('hijri: an ISO date or date-time, such as 2026-02-18T12:00:00Z.'),
  timeZone: text('timeZone', 'an IANA time zone, such as Asia/Dubai')
    .refine(validTimeZone, { error: 'timeZone must be an IANA time zone, such as Asia/Dubai.' })
    .describe('hijri: the IANA time zone whose calendar day counts, such as Asia/Riyadh. Required, because the Hijri day changes at local midnight.'),
  text: text('text', 'a string').describe('numerals: the text to convert. phone: the number as typed, in any common form, with Western or Arabic digits.'),
  to: z.enum(NUMERALS, says('to', 'arab for Arabic-Indic digits or latn for Western digits')).describe('numerals: arab for ٠-٩ or latn for 0-9.'),
  country: z.enum(GULF_COUNTRIES, says('country', oneOf(GULF_COUNTRIES))).describe(`phone: ${oneOf(GULF_COUNTRIES)}. Leave it out for an international number, and the country is read from its code.`),
  style: z.enum(PHONE_STYLES, says('style', oneOf(PHONE_STYLES))).describe('phone: national (050 123 4567), international (+971 50 123 4567) or e164 (+971501234567). Defaults to national.'),
}

const kind = <K extends (typeof KINDS)[number]>(k: K) => z.literal(k)

const input = z.discriminatedUnion('kind', [
  strictFor('money', { kind: kind('money'), amount: field.amount, currency: field.currency, locale: field.locale.optional(), numerals: field.numerals.optional(), fractionDigits: field.fractionDigits.optional() }),
  strictFor('hijri', { kind: kind('hijri'), date: field.date, timeZone: field.timeZone, locale: field.locale.optional(), numerals: field.numerals.optional() }),
  strictFor('numerals', { kind: kind('numerals'), text: field.text, to: field.to }),
  strictFor('phone', { kind: kind('phone'), text: field.text, country: field.country.optional(), style: field.style.optional() }),
], { error: `kind must be ${oneOf(KINDS)}.` })

type Input = z.infer<typeof input>
/** Keys whose value may be undefined become optional keys, so format's options see them as left out. */
type Defined<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & { [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined> }
const definedOnly = <T extends object>(o: T): Defined<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Defined<T>

function formatPhone(raw: string, given: GulfCountry | undefined, style: PhoneStyle | undefined): CallToolResult {
  let country = given
  if (country === undefined) {
    const found = parseGulfPhone(raw)
    if (!found.ok) return failure(found.error.message)
    country = found.value.country
  }
  const phone = PHONES[country]
  const parsed = phone.parse(raw)
  if (!parsed.ok) return failure(parsed.error.message)
  const formatted = phone.format(raw, definedOnly({ style }))
  return formatted === null ? failure('This number could not be formatted.') : result({ text: formatted, country })
}

function run(i: Input): CallToolResult {
  switch (i.kind) {
    case 'money':
      return result({ text: formatMoney(i.amount, definedOnly({ currency: i.currency, locale: i.locale, numerals: i.numerals, fractionDigits: i.fractionDigits })) })
    case 'hijri': {
      const date = new Date(i.date)
      return result({ text: formatHijri(date, definedOnly({ timeZone: i.timeZone, locale: i.locale, numerals: i.numerals })), hijri: toHijri(date, { timeZone: i.timeZone }) })
    }
    case 'numerals':
      return result({ text: i.to === 'arab' ? toArabicDigits(i.text) : toWesternDigits(i.text) })
    case 'phone':
      return formatPhone(i.text, i.country, i.style)
  }
}

export function registerFormat(server: McpServer): void {
  server.registerTool('format', {
    title: 'Format Gulf values',
    description: 'Formats a Gulf value with @dualkit/format. kind money: AED, SAR, QAR, KWD, BHD or OMR in English or Arabic. kind hijri: an Umm al-Qura date in a given time zone. kind numerals: converts between 0-9 and ٠-٩. kind phone: a GCC phone number in national, international or E.164 form.',
    inputSchema: lenient({
      kind: z.enum(KINDS).describe(`${oneOf(KINDS)}. Each kind reads only the fields marked with its name.`),
      ...Object.fromEntries(Object.entries(field).map(([k, s]) => [k, s.optional()])),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, run))
}
