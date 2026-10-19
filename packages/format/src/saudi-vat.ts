import { toWesternDigits } from './numerals'
import { err, ok, type Result } from './result'

export type SaudiVatError = 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix' | 'invalid_suffix'

const LENGTH = 15

/** Reads a Saudi VAT number: 15 digits, starting and ending with 3 (ZATCA BR-KSA-40). Spaces are allowed. */
export function parseSaudiVatNumber(input: string): Result<string, SaudiVatError> {
  const digits = toWesternDigits(input).replace(/\s/g, '')
  if (digits === '') return err('empty', 'Enter a VAT number.')
  if (!/^\d+$/.test(digits)) return err('invalid_characters', 'Use digits only.')
  if (digits.length !== LENGTH) return err('invalid_length', `A Saudi VAT number has ${LENGTH} digits.`)
  if (!digits.startsWith('3')) return err('invalid_prefix', 'A Saudi VAT number starts with 3.')
  if (!digits.endsWith('3')) return err('invalid_suffix', 'A Saudi VAT number ends with 3.')
  return ok(digits)
}

export const isValidSaudiVatNumber = (input: string): boolean => parseSaudiVatNumber(input).ok

/** The 15 digits with no separators, as ZATCA prints them. Null when the number cannot be read. */
export function formatSaudiVatNumber(input: string): string | null {
  const parsed = parseSaudiVatNumber(input)
  return parsed.ok ? parsed.value : null
}
