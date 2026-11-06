import { parseIban, toWesternDigits, type GulfIbanCountry, type Iban, type IbanError, type Numerals, type Result } from '@dualkit/format'
import { Input } from '@/components/ui/input'
import { GulfField, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfIbanResult = Result<Iban, IbanError>

export type GulfIbanInputProps = GulfFieldText<IbanError> & {
  /** The electronic form: capitals and Western digits, no spaces. */
  value: string
  onChange: (value: string) => void
  /** format's parseIban result for the new value. */
  onResult?: (result: GulfIbanResult) => void
  /** Accept only IBANs from this country. */
  country?: GulfIbanCountry
  numerals?: Numerals
}

/** The longest IBAN anywhere has 34 characters. */
const MAX_LENGTH = 34

/** Fours, as IBANs are printed. format's formatIban only groups a complete, valid IBAN, so the partial one is grouped here. */
const groupInFours = (value: string): string => value.replace(/(.{4})(?=.)/g, '$1 ')

/** An IBAN, grouped in fours as it is typed, left to right in both languages. */
export function GulfIbanInput(props: GulfIbanInputProps) {
  const { value, onChange, onResult, country, numerals = 'latn', label, help, error, errorMessages, id, name, placeholder, disabled, required, className } = props
  const read = (v: string): GulfIbanResult => parseIban(v, country ? { country } : {})
  const shown = useShownError(read(value), error, errorMessages)
  const mask: Mask = {
    normalize: (raw) => toWesternDigits(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_LENGTH),
    display: (v) => withNumerals(groupInFours(v), numerals),
    separator: / /,
  }
  const input = useMaskedInput(value, mask, (next) => {
    onChange(next)
    onResult?.(read(next))
  })

  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => (
        <Input {...aria} {...input} dir="ltr" autoCapitalize="characters" autoComplete="off" spellCheck={false}
          name={name} placeholder={placeholder} disabled={disabled} required={required}
          className="text-start font-mono" onBlur={shown.onBlur} />
      )}
    </GulfField>
  )
}
