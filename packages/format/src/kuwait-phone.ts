import { eightDigitPhone, fourFour, type PhoneStyle } from './eight-digit-phone'
import { err, type Result } from './result'

export type KuwaitPhoneType = 'mobile' | 'landline'
export type KuwaitPhone = { readonly e164: string; readonly type: KuwaitPhoneType }
export type KuwaitPhoneError = 'empty' | 'invalid_characters' | 'not_kuwait' | 'invalid_length' | 'unknown_prefix'
export type KuwaitPhoneStyle = PhoneStyle

const typeOf = (nsn: string): 'mobile' | 'landline' | null =>
  /^(41|[569])/.test(nsn) ? 'mobile' : nsn.startsWith('2') ? 'landline' : null

const phone = eightDigitPhone<KuwaitPhoneType, 'not_kuwait'>({
  countryCode: '965',
  otherCountry: err('not_kuwait', 'This is not a Kuwaiti number.'),
  unknownPrefix: 'This is not a Kuwaiti mobile or landline number.',
  typeOf,
  group: fourFour,
})

/** Reads any common way of writing a Kuwaiti mobile or landline number, in Western or Arabic digits. */
export const parseKuwaitPhone = (input: string): Result<KuwaitPhone, KuwaitPhoneError> => phone.parse(input)

export const isValidKuwaitPhone = (input: string): boolean => phone.isValid(input)

/** "5001 2345", "+965 5001 2345" or "+965...". Null when the number cannot be read. */
export const formatKuwaitPhone = (input: string, options: { readonly style?: KuwaitPhoneStyle } = {}): string | null =>
  phone.format(input, options)
