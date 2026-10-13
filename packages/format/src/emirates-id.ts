import { passesLuhn } from './luhn'
import { toWesternDigits } from './numerals'
import { err, ok, type Result } from './result'

export type EmiratesId = { readonly digits: string; readonly formatted: string; readonly year: number }
export type EmiratesIdError = 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix' | 'invalid_checksum'

const LENGTH = 15
const PREFIX = '784'

/** Reads an Emirates ID (784-YYYY-NNNNNNN-C). The year is usually the holder's birth year. */
export function parseEmiratesId(input: string): Result<EmiratesId, EmiratesIdError> {
  const raw = toWesternDigits(input).trim()
  if (raw === '') return err('empty', 'Enter an Emirates ID number.')
  if (!/^[\d\s-]+$/.test(raw)) return err('invalid_characters', 'Use digits only.')
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== LENGTH) return err('invalid_length', 'An Emirates ID has 15 digits.')
  if (!digits.startsWith(PREFIX)) return err('invalid_prefix', 'An Emirates ID starts with 784.')
  if (!passesLuhn(digits)) return err('invalid_checksum', 'This Emirates ID number is not valid. Check for a typo.')
  const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`
  return ok({ digits, formatted, year: Number(digits.slice(3, 7)) })
}

export const isValidEmiratesId = (input: string): boolean => parseEmiratesId(input).ok

export function formatEmiratesId(input: string): string | null {
  const parsed = parseEmiratesId(input)
  return parsed.ok ? parsed.value.formatted : null
}
