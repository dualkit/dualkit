import { nationalNumber, readPhoneInput } from './phone-input'
import { err, ok, type Err, type Result } from './result'

export type PhoneStyle = 'national' | 'international' | 'e164'
export type EightDigitSpec<T extends string, N extends string> = {
  readonly countryCode: string
  readonly otherCountry: Err<N>
  readonly unknownPrefix: string
  /** The number's type from its leading digits, or null when no network or area uses them. */
  readonly typeOf: (nsn: string) => T | null
  /** The display groups of a national number. */
  readonly group: (nsn: string, type: T) => string
}

const NATIONAL_LENGTH = 8

/** Parse and format for a country with an 8-digit national number and no trunk 0. */
export function eightDigitPhone<T extends string, N extends string>(spec: EightDigitSpec<T, N>) {
  const rule = { countryCode: spec.countryCode, minLength: NATIONAL_LENGTH, otherCountry: spec.otherCountry, trunkZero: false } as const
  type Code = 'empty' | 'invalid_characters' | N | 'invalid_length' | 'unknown_prefix'

  function parse(input: string): Result<{ readonly e164: string; readonly type: T }, Code> {
    const raw = readPhoneInput(input)
    if (!raw.ok) return raw
    const nsn = nationalNumber(raw.value, rule)
    if (!nsn.ok) return nsn
    const type = spec.typeOf(nsn.value)
    if (type === null) return err('unknown_prefix', spec.unknownPrefix)
    if (nsn.value.length !== NATIONAL_LENGTH) return err('invalid_length', 'This number has the wrong number of digits.')
    return ok({ e164: `+${spec.countryCode}${nsn.value}`, type })
  }

  function format(input: string, options: { readonly style?: PhoneStyle } = {}): string | null {
    const parsed = parse(input)
    if (!parsed.ok) return null
    const { e164, type } = parsed.value
    const style = options.style ?? 'national'
    if (style === 'e164') return e164
    const grouped = spec.group(e164.slice(spec.countryCode.length + 1), type)
    return style === 'national' ? grouped : `+${spec.countryCode} ${grouped}`
  }

  return { parse, format, isValid: (input: string): boolean => parse(input).ok }
}

/** "3312 3456". */
export const fourFour = (nsn: string): string => `${nsn.slice(0, 4)} ${nsn.slice(4)}`
