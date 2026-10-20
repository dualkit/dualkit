import { eightDigitPhone, fourFour, type PhoneStyle } from './eight-digit-phone'
import { err, type Result } from './result'

export type OmanPhoneType = 'mobile' | 'landline'
export type OmanPhone = { readonly e164: string; readonly type: OmanPhoneType }
export type OmanPhoneError = 'empty' | 'invalid_characters' | 'not_oman' | 'invalid_length' | 'unknown_prefix'
export type OmanPhoneStyle = PhoneStyle

/** 73 is unassigned and 900 is not a mobile range, so only 901 to 909 count under 90. */
const typeOf = (nsn: string): 'mobile' | 'landline' | null => {
  if (/^(7[1245679]|90[1-9]|9[1-9])/.test(nsn)) return 'mobile'
  return /^2[1-6]/.test(nsn) ? 'landline' : null
}

/** Mobiles read XXXX XXXX and landlines XX XXXXXX. */
const group = (nsn: string, type: OmanPhoneType): string =>
  type === 'landline' ? `${nsn.slice(0, 2)} ${nsn.slice(2)}` : fourFour(nsn)

const phone = eightDigitPhone<OmanPhoneType, 'not_oman'>({
  countryCode: '968',
  otherCountry: err('not_oman', 'This is not an Omani number.'),
  unknownPrefix: 'This is not an Omani mobile or landline number.',
  typeOf,
  group,
})

/** Reads any common way of writing an Omani mobile or landline number, in Western or Arabic digits. */
export const parseOmanPhone = (input: string): Result<OmanPhone, OmanPhoneError> => phone.parse(input)

/** True when the input reads as an Omani mobile or landline number. */
export const isValidOmanPhone = (input: string): boolean => phone.isValid(input)

/** "9212 3456", "+968 9212 3456" or "+968...". Null when the number cannot be read. */
export const formatOmanPhone = (input: string, options: { readonly style?: OmanPhoneStyle } = {}): string | null =>
  phone.format(input, options)
