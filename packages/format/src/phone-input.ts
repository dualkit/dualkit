import { toWesternDigits } from './numerals'
import { err, ok, type Err, type Result } from './result'

export type PhoneInputError = 'empty' | 'invalid_characters'

/** People often keep the trunk 0 after the country code, as in "+971 (0) 50 123 4567". */
const dropTrunkZero = (digits: string): string => (digits.startsWith('0') ? digits.slice(1) : digits)

/** Trims the input, turns Arabic-Indic digits Western, and refuses anything that is not a phone number. */
export function readPhoneInput(input: string): Result<string, PhoneInputError> {
  const raw = toWesternDigits(input).trim()
  if (raw === '') return err('empty', 'Enter a phone number.')
  if (!/^\+?[\d\s().-]+$/.test(raw)) return err('invalid_characters', 'Use digits only.')
  return ok(raw)
}

export type NationalNumberRule<C extends string> = {
  readonly countryCode: string
  /** The shortest national number, so "971…" typed without a plus is only read as a country code when it fits. */
  readonly minLength: number
  readonly otherCountry: Err<C>
  /** Whether a leading 0 is a trunk prefix to drop. Defaults to true; Qatar, Kuwait, Bahrain and Oman have none. */
  readonly trunkZero?: boolean
}

/** Strips the country code or trunk 0, leaving the national significant number. */
export function nationalNumber<C extends string>(raw: string, rule: NationalNumberRule<C>): Result<string, C> {
  const { countryCode, minLength, otherCountry, trunkZero = true } = rule
  const strip = (value: string): string => (trunkZero ? dropTrunkZero(value) : value)
  const plus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (plus || digits.startsWith('00')) {
    const international = plus ? digits : digits.slice(2)
    if (!international.startsWith(countryCode)) return otherCountry
    return ok(strip(international.slice(countryCode.length)))
  }
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + minLength) {
    return ok(digits.slice(countryCode.length))
  }
  return ok(strip(digits))
}
