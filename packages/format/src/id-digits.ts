import { toWesternDigits } from './numerals'
import { err, ok, type Result } from './result'

export type IdDigitsError = 'empty' | 'invalid_characters'

/** Reads the digits of an ID typed with Western or Arabic digits, spaces and dashes. `document` names it in the empty message. */
export function readIdDigits(input: string, document: string): Result<string, IdDigitsError> {
  const raw = toWesternDigits(input).trim()
  if (raw === '') return err('empty', `Enter a ${document} number.`)
  if (!/^[\d\s-]+$/.test(raw)) return err('invalid_characters', 'Use digits only.')
  return ok(raw.replace(/\D/g, ''))
}
