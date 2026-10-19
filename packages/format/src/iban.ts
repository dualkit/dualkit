import { toWesternDigits } from './numerals'
import { err, ok, type Result } from './result'

export type GulfIbanCountry = 'AE' | 'SA' | 'BH' | 'KW' | 'QA' | 'OM'
export type Iban = {
  readonly country: GulfIbanCountry
  readonly electronic: string
  readonly formatted: string
  readonly bankCode: string
}
export type IbanError =
  | 'empty' | 'invalid_characters' | 'unsupported_country' | 'wrong_country' | 'invalid_length' | 'invalid_checksum'

/** Length and bank-code width per country, from the SWIFT IBAN registry. */
const COUNTRIES: Record<GulfIbanCountry, { readonly length: number; readonly bankCode: number }> = {
  AE: { length: 23, bankCode: 3 },
  SA: { length: 24, bankCode: 2 },
  BH: { length: 22, bankCode: 4 },
  KW: { length: 30, bankCode: 4 },
  QA: { length: 29, bankCode: 4 },
  OM: { length: 23, bankCode: 3 },
}

const isGulfCountry = (code: string): code is GulfIbanCountry => Object.hasOwn(COUNTRIES, code)

function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const value = Number.parseInt(ch, 36)
    remainder = (value > 9 ? remainder * 100 + value : remainder * 10 + value) % 97
  }
  return remainder
}

/** Reads a Gulf IBAN, in print or electronic form, with Western or Arabic digits. */
export function parseIban(
  input: string,
  options: { readonly country?: GulfIbanCountry } = {},
): Result<Iban, IbanError> {
  const electronic = toWesternDigits(input).replace(/\s/g, '').toUpperCase()
  if (electronic === '') return err('empty', 'Enter an IBAN.')
  if (!/^[A-Z0-9]+$/.test(electronic)) return err('invalid_characters', 'Use letters and digits only.')
  const country = electronic.slice(0, 2)
  if (!isGulfCountry(country)) return err('unsupported_country', 'Only Gulf IBANs are supported.')
  if (options.country && options.country !== country) {
    return err('wrong_country', `This IBAN is from ${country}, not ${options.country}.`)
  }
  const spec = COUNTRIES[country]
  if (electronic.length !== spec.length) {
    return err('invalid_length', `A ${country} IBAN has ${spec.length} characters.`)
  }
  if (mod97(electronic) !== 1) return err('invalid_checksum', 'This IBAN is not valid. Check for a typo.')
  return ok({
    country,
    electronic,
    formatted: electronic.replace(/(.{4})(?=.)/g, '$1 '),
    bankCode: electronic.slice(4, 4 + spec.bankCode),
  })
}

export const isValidIban = (input: string): boolean => parseIban(input).ok

export function formatIban(input: string): string | null {
  const parsed = parseIban(input)
  return parsed.ok ? parsed.value.formatted : null
}
