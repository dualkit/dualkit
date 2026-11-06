import { parseEmiratesId, toWesternDigits, type EmiratesId, type EmiratesIdError, type Numerals, type Result } from '@dualkit/format'
import { Input } from '@/components/ui/input'
import { GulfField, cx, LTR_PLACEHOLDER, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfNationalIdResult = Result<EmiratesId, EmiratesIdError>

export type GulfNationalIdInputProps = GulfFieldText<EmiratesIdError> & {
  /** The 15 digits, Western, without hyphens. */
  value: string
  onChange: (value: string) => void
  /** format's parseEmiratesId result for the new value. */
  onResult?: (result: GulfNationalIdResult) => void
  numerals?: Numerals
}

/** 784-YYYY-NNNNNNN-C. Saudi ID and Iqama wait until format has a tested validator. */
const GROUPS = [3, 4, 7, 1] as const
const LENGTH = 15

/** Hyphens between the groups typed so far. formatEmiratesId only formats a complete, valid ID, so the partial one is grouped here. */
function hyphenate(digits: string): string {
  const parts: string[] = []
  let start = 0
  for (const size of GROUPS) {
    if (start >= digits.length) break
    parts.push(digits.slice(start, start + size))
    start += size
  }
  return parts.join('-')
}

const ID_MASK: Mask = {
  normalize: (raw) => toWesternDigits(raw).replace(/\D/g, '').slice(0, LENGTH),
  display: hyphenate,
  separator: /-/,
}

/** An Emirates ID number, hyphenated as it is typed, left to right in both languages. */
export function GulfNationalIdInput(props: GulfNationalIdInputProps) {
  const { value, onChange, onResult, numerals = 'latn', label, help, error, errorMessages, id, name, placeholder, disabled, required, className } = props
  const shown = useShownError(parseEmiratesId(value), error, errorMessages)
  const input = useMaskedInput(value, { ...ID_MASK, display: (v) => withNumerals(hyphenate(v), numerals) }, (next) => {
    onChange(next)
    onResult?.(parseEmiratesId(next))
  })

  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => (
        <Input {...aria} {...input} dir="ltr" inputMode="numeric" autoComplete="off"
          name={name} placeholder={placeholder} disabled={disabled} required={required}
          className={cx('text-start font-mono', LTR_PLACEHOLDER)} onBlur={shown.onBlur} />
      )}
    </GulfField>
  )
}
