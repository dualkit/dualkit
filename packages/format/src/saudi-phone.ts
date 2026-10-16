import { nationalNumber, readPhoneInput } from './phone-input'
import { err, ok, type Result } from './result'

export type SaudiPhoneType = 'mobile' | 'landline'
export type SaudiPhone = { readonly e164: string; readonly type: SaudiPhoneType }
export type SaudiPhoneError = 'empty' | 'invalid_characters' | 'not_saudi' | 'invalid_length' | 'unknown_prefix'
export type SaudiPhoneStyle = 'national' | 'international' | 'e164'

const COUNTRY_CODE = '966'
/** 052 is unassigned. Number portability means a prefix no longer tells you the network. */
const MOBILE_PREFIXES = new Set(['50', '51', '53', '54', '55', '56', '57', '58', '59'])
/** 010, 015, 018 and 019 are held in reserve. */
const AREA_CODES = new Set(['11', '12', '13', '14', '16', '17'])
/** Mobiles and landlines are both nine digits after the trunk 0. */
const NATIONAL_LENGTH = 9

const NATIONAL_RULE = {
  countryCode: COUNTRY_CODE,
  minLength: NATIONAL_LENGTH,
  otherCountry: err('not_saudi', 'This is not a Saudi number.'),
} as const

function classify(nsn: string): Result<SaudiPhone, SaudiPhoneError> {
  const e164 = `+${COUNTRY_CODE}${nsn}`
  const prefix = nsn.slice(0, 2)
  const type = nsn.startsWith('5') ? 'mobile' : nsn.startsWith('1') ? 'landline' : null
  if (type === null) return err('unknown_prefix', 'This is not a Saudi mobile or landline number.')
  if (nsn.length !== NATIONAL_LENGTH) return err('invalid_length', 'This number has the wrong number of digits.')
  if (type === 'mobile' && !MOBILE_PREFIXES.has(prefix)) {
    return err('unknown_prefix', 'No Saudi mobile network uses this prefix.')
  }
  if (type === 'landline' && !AREA_CODES.has(prefix)) return err('unknown_prefix', 'This Saudi area code is not in use.')
  return ok({ e164, type })
}

/** Reads any common way of writing a Saudi mobile or landline number, in Western or Arabic digits. */
export function parseSaudiPhone(input: string): Result<SaudiPhone, SaudiPhoneError> {
  const raw = readPhoneInput(input)
  if (!raw.ok) return raw
  const nsn = nationalNumber(raw.value, NATIONAL_RULE)
  return nsn.ok ? classify(nsn.value) : nsn
}

export const isValidSaudiPhone = (input: string): boolean => parseSaudiPhone(input).ok

/** "055 123 4567", "+966 55 123 4567" or "+966551234567". Null when the number cannot be read. */
export function formatSaudiPhone(input: string, options: { readonly style?: SaudiPhoneStyle } = {}): string | null {
  const parsed = parseSaudiPhone(input)
  if (!parsed.ok) return null
  const { e164 } = parsed.value
  const style = options.style ?? 'national'
  if (style === 'e164') return e164
  const nsn = e164.slice(COUNTRY_CODE.length + 1)
  const groups = `${nsn.slice(2, 5)} ${nsn.slice(5)}`
  return style === 'national' ? `0${nsn.slice(0, 2)} ${groups}` : `+${COUNTRY_CODE} ${nsn.slice(0, 2)} ${groups}`
}
