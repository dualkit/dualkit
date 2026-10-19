import { parseBahrainPhone } from './bahrain-phone'
import { parseKuwaitPhone } from './kuwait-phone'
import { parseOmanPhone } from './oman-phone'
import { readPhoneInput } from './phone-input'
import { parseUaePhone } from './phone'
import { parseQatarPhone } from './qatar-phone'
import { err, ok, type Result } from './result'
import { parseSaudiPhone } from './saudi-phone'

export type GulfCountry = 'AE' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'
export type GulfPhone = {
  readonly country: GulfCountry
  readonly e164: string
  readonly type: 'mobile' | 'landline' | 'unknown'
}
export type GulfPhoneError =
  | 'empty' | 'invalid_characters' | 'needs_country_code' | 'not_gulf' | 'invalid_length' | 'unknown_prefix'

type CountryParser = (input: string) => Result<{ readonly e164: string; readonly type: GulfPhone['type'] }, string>

const COUNTRIES: Record<string, { readonly country: GulfCountry; readonly parse: CountryParser }> = {
  '971': { country: 'AE', parse: parseUaePhone },
  '966': { country: 'SA', parse: parseSaudiPhone },
  '974': { country: 'QA', parse: parseQatarPhone },
  '965': { country: 'KW', parse: parseKuwaitPhone },
  '973': { country: 'BH', parse: parseBahrainPhone },
  '968': { country: 'OM', parse: parseOmanPhone },
}

/** Reads an international number from any GCC country. An 8-digit number alone fits four of them, so it needs a + or 00. */
export function parseGulfPhone(input: string): Result<GulfPhone, GulfPhoneError> {
  const raw = readPhoneInput(input)
  if (!raw.ok) return raw
  const digits = raw.value.replace(/\D/g, '')
  const international = raw.value.startsWith('+') ? digits : digits.startsWith('00') ? digits.slice(2) : null
  if (international === null) return err('needs_country_code', 'Start the number with + and the country code.')
  const match = COUNTRIES[international.slice(0, 3)]
  if (!match) return err('not_gulf', 'This is not a GCC number.')
  const parsed = match.parse(raw.value)
  if (parsed.ok) return ok({ country: match.country, ...parsed.value })
  const { code, message } = parsed.error
  return err(code as GulfPhoneError, message)
}

/** True when the input is an international number from any GCC country. */
export const isValidGulfPhone = (input: string): boolean => parseGulfPhone(input).ok
