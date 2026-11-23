import { readIdDigits, type IdDigitsError } from './id-digits'
import { passesLuhn } from './luhn'
import { err, ok, type Result } from './result'

export type SaudiIdHolder = 'citizen' | 'resident'
export type SaudiId = { readonly digits: string; readonly formatted: string; readonly holder: SaudiIdHolder }
export type SaudiIdError = IdDigitsError | 'invalid_length' | 'invalid_prefix' | 'invalid_checksum'

const LENGTH = 10
const HOLDERS: Readonly<Record<string, SaudiIdHolder>> = { '1': 'citizen', '2': 'resident' }

/**
 * Reads a Saudi national ID (starts with 1) or Iqama (starts with 2). The check digit uses the Luhn formula that
 * public libraries implement; the Ministry of Interior shares the official formula only on request.
 */
export function parseSaudiId(input: string): Result<SaudiId, SaudiIdError> {
  const read = readIdDigits(input, 'Saudi ID or Iqama')
  if (!read.ok) return read
  const digits = read.value
  if (digits.length !== LENGTH) return err('invalid_length', 'A Saudi ID or Iqama has 10 digits.')
  const holder = HOLDERS[digits.charAt(0)]
  if (holder === undefined) return err('invalid_prefix', 'A Saudi ID starts with 1, an Iqama with 2.')
  if (!passesLuhn(digits)) return err('invalid_checksum', 'This Saudi ID or Iqama number is not valid. Check for a typo.')
  return ok({ digits, formatted: digits, holder })
}
