import { eightDigitPhone, fourFour, type PhoneStyle } from './eight-digit-phone'
import { err, type Result } from './result'

export type BahrainPhoneType = 'mobile' | 'landline' | 'unknown'
export type BahrainPhone = { readonly e164: string; readonly type: BahrainPhoneType }
export type BahrainPhoneError = 'empty' | 'invalid_characters' | 'not_bahrain' | 'invalid_length' | 'unknown_prefix'
export type BahrainPhoneStyle = PhoneStyle

/** The whole 3 block is mobile. 6 and 77 mix mobile and fixed ranges, so their type is unknown. */
const typeOf = (nsn: string): 'mobile' | 'landline' | 'unknown' | null => {
  if (nsn.startsWith('3')) return 'mobile'
  if (/^1[367]/.test(nsn)) return 'landline'
  return nsn.startsWith('6') || nsn.startsWith('77') ? 'unknown' : null
}

const phone = eightDigitPhone<BahrainPhoneType, 'not_bahrain'>({
  countryCode: '973',
  otherCountry: err('not_bahrain', 'This is not a Bahraini number.'),
  unknownPrefix: 'This is not a Bahraini mobile or landline number.',
  typeOf,
  group: fourFour,
})

/** Reads any common way of writing a Bahraini mobile or landline number, in Western or Arabic digits. */
export const parseBahrainPhone = (input: string): Result<BahrainPhone, BahrainPhoneError> => phone.parse(input)

/** True when the input reads as a Bahraini mobile or landline number. */
export const isValidBahrainPhone = (input: string): boolean => phone.isValid(input)

/** "3600 1234", "+973 3600 1234" or "+973...". Null when the number cannot be read. */
export const formatBahrainPhone = (input: string, options: { readonly style?: BahrainPhoneStyle } = {}): string | null =>
  phone.format(input, options)
