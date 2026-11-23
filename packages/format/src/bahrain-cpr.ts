import { readIdDigits, type IdDigitsError } from './id-digits'
import { err, ok, type Result } from './result'

export type BahrainCpr = { readonly digits: string; readonly formatted: string }
export type BahrainCprError = IdDigitsError | 'invalid_length'

const LENGTH = 9

/**
 * Reads a Bahrain CPR number. Its check digit formula is not public and personal numbers can be bought,
 * so this checks the length only.
 */
export function parseBahrainCpr(input: string): Result<BahrainCpr, BahrainCprError> {
  const read = readIdDigits(input, 'Bahrain CPR')
  if (!read.ok) return read
  const digits = read.value
  if (digits.length !== LENGTH) return err('invalid_length', 'A Bahrain CPR number has 9 digits.')
  return ok({ digits, formatted: digits })
}
