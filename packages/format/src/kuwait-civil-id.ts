import { readIdDigits, type IdDigitsError } from './id-digits'
import { err, ok, type Result } from './result'

export type KuwaitCivilId = { readonly digits: string; readonly formatted: string; readonly birthDate: string }
export type KuwaitCivilIdError = IdDigitsError | 'invalid_length' | 'invalid_prefix' | 'invalid_birth_date' | 'invalid_checksum'

const LENGTH = 12
/** The first digit is the century of birth. */
const CENTURIES: Readonly<Record<string, number>> = { '1': 1800, '2': 1900, '3': 2000 }
/** PACI weights for the first 11 digits, as in django-localflavor's kw validator. */
const WEIGHTS = [2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/** The YYYY-MM-DD birth date in digits 2 to 7, or null when that date does not exist. */
function birthDate(digits: string, century: number): string | null {
  const year = century + Number(digits.slice(1, 3))
  const month = Number(digits.slice(3, 5))
  const day = Number(digits.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1, day))
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return real ? `${year}-${pad(month)}-${pad(day)}` : null
}

/** 11 minus the weighted sum mod 11. It can be 10 or 11, which no check digit matches. */
const checkValue = (digits: string): number =>
  11 - (WEIGHTS.reduce((sum, weight, i) => sum + weight * Number(digits[i]), 0) % 11)

/** Reads a Kuwait Civil ID: 12 digits, the holder's birth date in digits 2 to 7, and a weighted check digit. */
export function parseKuwaitCivilId(input: string): Result<KuwaitCivilId, KuwaitCivilIdError> {
  const read = readIdDigits(input, 'Kuwait Civil ID')
  if (!read.ok) return read
  const digits = read.value
  if (digits.length !== LENGTH) return err('invalid_length', 'A Kuwait Civil ID has 12 digits.')
  const century = CENTURIES[digits.charAt(0)]
  if (century === undefined) return err('invalid_prefix', 'A Kuwait Civil ID starts with 1, 2 or 3.')
  const born = birthDate(digits, century)
  if (born === null) return err('invalid_birth_date', 'The birth date in this Civil ID does not exist. Check for a typo.')
  if (checkValue(digits) !== Number(digits[11])) {
    return err('invalid_checksum', 'This Kuwait Civil ID number is not valid. Check for a typo.')
  }
  return ok({ digits, formatted: digits, birthDate: born })
}
