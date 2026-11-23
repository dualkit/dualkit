import { readIdDigits, type IdDigitsError } from './id-digits'
import { err, ok, type Result } from './result'

export type QatarId = {
  readonly digits: string
  readonly formatted: string
  /** The last two digits of the birth year, as printed. */
  readonly birthYear: string
  /** The 3-digit ISO 3166 numeric nationality code, read but not checked against a list. */
  readonly nationality: string
}
export type QatarIdError = IdDigitsError | 'invalid_length' | 'invalid_prefix'

const LENGTH = 11

/** Reads a Qatar ID (QID). No check digit is public, so this checks the shape only: 11 digits starting with 2 or 3. */
export function parseQatarId(input: string): Result<QatarId, QatarIdError> {
  const read = readIdDigits(input, 'Qatar ID')
  if (!read.ok) return read
  const digits = read.value
  if (digits.length !== LENGTH) return err('invalid_length', 'A Qatar ID has 11 digits.')
  if (digits[0] !== '2' && digits[0] !== '3') return err('invalid_prefix', 'A Qatar ID starts with 2 or 3.')
  return ok({ digits, formatted: digits, birthYear: digits.slice(1, 3), nationality: digits.slice(3, 6) })
}
