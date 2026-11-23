import { useEffect, useRef } from 'react'
import {
  NATIONAL_ID_EXAMPLES, NATIONAL_ID_LENGTH, formatNationalId, parseNationalId, toWesternDigits,
  type NationalId, type NationalIdCountry, type NationalIdError, type Numerals, type Result,
} from '@dualkit/format'
import { Input } from '@/components/ui/input'
import { GulfField, cx, LTR_PLACEHOLDER, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfNationalIdResult = Result<NationalId, NationalIdError>

export type GulfNationalIdInputProps = GulfFieldText<NationalIdError> & {
  /** The digits, Western, without hyphens. */
  value: string
  onChange: (value: string) => void
  /** format's parseNationalId result for the new value. */
  onResult?: (result: GulfNationalIdResult) => void
  numerals?: Numerals
  /** Whose ID this is: AE (Emirates ID), SA (ID or Iqama), KW (Civil ID), QA (QID) or BH (CPR). Defaults to AE. */
  country?: NationalIdCountry
}

/** 784-YYYY-NNNNNNN-C. The other countries print their IDs as plain digits. */
const EMIRATES_GROUPS = [3, 4, 7, 1] as const

/** Hyphens between the Emirates ID groups typed so far. formatNationalId only formats a complete, valid ID. */
function hyphenate(digits: string): string {
  const parts: string[] = []
  let start = 0
  for (const size of EMIRATES_GROUPS) {
    if (start >= digits.length) break
    parts.push(digits.slice(start, start + size))
    start += size
  }
  return parts.join('-')
}

const group = (digits: string, country: NationalIdCountry): string => (country === 'AE' ? hyphenate(digits) : digits)

const normalizer = (country: NationalIdCountry) => (raw: string): string =>
  toWesternDigits(raw).replace(/\D/g, '').slice(0, NATIONAL_ID_LENGTH[country])

/** A Gulf national ID number, grouped as it is typed, left to right in both languages. */
export function GulfNationalIdInput(props: GulfNationalIdInputProps) {
  const { value, onChange, onResult, numerals = 'latn', country = 'AE', label, help, error, errorMessages, id, name, placeholder, disabled, required, className } = props
  const shown = useShownError(parseNationalId(value, country), error, errorMessages)
  const mask: Mask = { normalize: normalizer(country), display: (v) => withNumerals(group(v, country), numerals), separator: /-/ }
  const input = useMaskedInput(value, mask, (next) => {
    onChange(next)
    onResult?.(parseNationalId(next, country))
  })

  // A new country can make the stored value too long, and changes its result either way.
  const previous = useRef(country)
  useEffect(() => {
    if (previous.current === country) return
    previous.current = country
    const next = normalizer(country)(value)
    if (next !== value) onChange(next)
    onResult?.(parseNationalId(next, country))
  }, [country, value, onChange, onResult])

  const example = formatNationalId(NATIONAL_ID_EXAMPLES[country], country) ?? ''
  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => (
        <Input {...aria} {...input} dir="ltr" inputMode="numeric" autoComplete="off"
          name={name} placeholder={placeholder ?? withNumerals(example, numerals)} disabled={disabled} required={required}
          className={cx('text-start font-mono', LTR_PLACEHOLDER)} onBlur={shown.onBlur} />
      )}
    </GulfField>
  )
}
