import { toWesternDigits } from './numerals'
import { err, ok, type Result } from './result'

export type UaePhoneType = 'mobile' | 'landline'
export type UaePhone = { readonly e164: string; readonly type: UaePhoneType }
export type UaePhoneError = 'empty' | 'invalid_characters' | 'not_uae' | 'invalid_length' | 'unknown_prefix'
export type UaePhoneStyle = 'national' | 'international' | 'e164'

const COUNTRY_CODE = '971'
const MOBILE_PREFIXES = new Set(['50', '52', '54', '55', '56', '58'])
const AREA_CODES = new Set(['2', '3', '4', '6', '7', '9'])
const MOBILE_LENGTH = 9
const LANDLINE_LENGTH = 8

/** People often keep the trunk 0 after +971, as in "+971 (0) 50 123 4567". */
const dropTrunkZero = (digits: string): string => (digits.startsWith('0') ? digits.slice(1) : digits)

function nationalDigits(raw: string): Result<string, UaePhoneError> {
  const plus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (plus || digits.startsWith('00')) {
    const international = plus ? digits : digits.slice(2)
    if (!international.startsWith(COUNTRY_CODE)) return err('not_uae', 'This is not a UAE number.')
    return ok(dropTrunkZero(international.slice(COUNTRY_CODE.length)))
  }
  if (digits.startsWith(COUNTRY_CODE) && digits.length >= COUNTRY_CODE.length + LANDLINE_LENGTH) {
    return ok(digits.slice(COUNTRY_CODE.length))
  }
  return ok(dropTrunkZero(digits))
}

function classify(nsn: string): Result<UaePhone, UaePhoneError> {
  const e164 = `+${COUNTRY_CODE}${nsn}`
  const lengthError = err('invalid_length' as const, 'This number has the wrong number of digits.')
  if (nsn.startsWith('5')) {
    if (nsn.length !== MOBILE_LENGTH) return lengthError
    if (!MOBILE_PREFIXES.has(nsn.slice(0, 2))) return err('unknown_prefix', 'No UAE mobile network uses this prefix.')
    return ok({ e164, type: 'mobile' })
  }
  if (AREA_CODES.has(nsn.charAt(0))) {
    return nsn.length === LANDLINE_LENGTH ? ok({ e164, type: 'landline' }) : lengthError
  }
  return err('unknown_prefix', 'This is not a UAE mobile or landline number.')
}

/** Reads any common way of writing a UAE mobile or landline number, in Western or Arabic digits. */
export function parseUaePhone(input: string): Result<UaePhone, UaePhoneError> {
  const raw = toWesternDigits(input).trim()
  if (raw === '') return err('empty', 'Enter a phone number.')
  if (!/^\+?[\d\s().-]+$/.test(raw)) return err('invalid_characters', 'Use digits only.')
  const nsn = nationalDigits(raw)
  return nsn.ok ? classify(nsn.value) : nsn
}

export const isValidUaePhone = (input: string): boolean => parseUaePhone(input).ok

/** "050 123 4567", "+971 50 123 4567" or "+971501234567". Null when the number cannot be read. */
export function formatUaePhone(input: string, options: { readonly style?: UaePhoneStyle } = {}): string | null {
  const parsed = parseUaePhone(input)
  if (!parsed.ok) return null
  const { e164, type } = parsed.value
  const style = options.style ?? 'national'
  if (style === 'e164') return e164
  const nsn = e164.slice(COUNTRY_CODE.length + 1)
  const split = type === 'mobile' ? 2 : 1
  const groups = `${nsn.slice(split, split + 3)} ${nsn.slice(split + 3)}`
  return style === 'national' ? `0${nsn.slice(0, split)} ${groups}` : `+${COUNTRY_CODE} ${nsn.slice(0, split)} ${groups}`
}
