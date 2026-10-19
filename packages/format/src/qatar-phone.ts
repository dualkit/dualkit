import { eightDigitPhone, fourFour, type PhoneStyle } from './eight-digit-phone'
import { err, type Result } from './result'

export type QatarPhoneType = 'mobile' | 'landline'
export type QatarPhone = { readonly e164: string; readonly type: QatarPhoneType }
export type QatarPhoneError = 'empty' | 'invalid_characters' | 'not_qatar' | 'invalid_length' | 'unknown_prefix'
export type QatarPhoneStyle = PhoneStyle

const typeOf = (nsn: string): 'mobile' | 'landline' | null =>
  /^[3567]/.test(nsn) ? 'mobile' : nsn.startsWith('4') ? 'landline' : null

const phone = eightDigitPhone<QatarPhoneType, 'not_qatar'>({
  countryCode: '974',
  otherCountry: err('not_qatar', 'This is not a Qatari number.'),
  unknownPrefix: 'This is not a Qatari mobile or landline number.',
  typeOf,
  group: fourFour,
})

/** Reads any common way of writing a Qatari mobile or landline number, in Western or Arabic digits. */
export const parseQatarPhone = (input: string): Result<QatarPhone, QatarPhoneError> => phone.parse(input)

/** True when the input reads as a Qatari mobile or landline number. */
export const isValidQatarPhone = (input: string): boolean => phone.isValid(input)

/** "3312 3456", "+974 3312 3456" or "+974...". Null when the number cannot be read. */
export const formatQatarPhone = (input: string, options: { readonly style?: QatarPhoneStyle } = {}): string | null =>
  phone.format(input, options)
