import {
  parseGulfPhone, toWesternDigits,
  type GulfCountry, type GulfPhone, type GulfPhoneError, type Numerals, type Result,
} from '@dualkit/format'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { GulfField, cx, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfPhoneResult = Result<GulfPhone, GulfPhoneError>

/** The six GCC calling codes, in the order the picker lists them. */
export const GULF_DIAL_CODES: Readonly<Record<GulfCountry, string>> = {
  AE: '971', SA: '966', QA: '974', KW: '965', BH: '973', OM: '968',
}
const COUNTRIES = Object.keys(GULF_DIAL_CODES) as GulfCountry[]

/**
 * Reads what was typed with the picked country. A number typed with + or 00 keeps its own country code;
 * anything else is read as a national number of the picked country. Parsing is format's parseGulfPhone.
 */
export function readGulfPhone(value: string, country: GulfCountry): GulfPhoneResult {
  const typed = toWesternDigits(value).trim()
  if (typed === '' || typed.startsWith('+') || typed.startsWith('00')) return parseGulfPhone(typed)
  return parseGulfPhone(`+${GULF_DIAL_CODES[country]} ${typed}`)
}

export type GulfPhoneInputProps = GulfFieldText<GulfPhoneError> & {
  /** What was typed, with Western digits. */
  value: string
  onChange: (value: string) => void
  /** format's result for the new value, on every change of number or country. */
  onResult?: (result: GulfPhoneResult) => void
  /** The picked country, when the app controls it. */
  country?: GulfCountry
  defaultCountry?: GulfCountry
  onCountryChange?: (country: GulfCountry) => void
  /** The accessible name of the country picker. */
  countryLabel: string
  /** Names shown before each code. Without one the ISO code shows, as in "AE +971". */
  countryNames?: Partial<Record<GulfCountry, string>>
  /** Digits on screen. The value is always Western. */
  numerals?: Numerals
}

const PHONE_MASK: Mask = {
  normalize: (raw) => toWesternDigits(raw).replace(/[^\d\s()+.-]/g, '').slice(0, 20),
  display: (value) => value,
}

const SELECT = cx(
  'border-input h-9 shrink-0 rounded-md border bg-transparent ps-2 pe-1 text-base shadow-xs outline-none md:text-sm',
  'dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/** A GCC phone number: country picker and number, kept left to right as one unit in both languages. */
export function GulfPhoneInput(props: GulfPhoneInputProps) {
  const {
    value, onChange, onResult, country, defaultCountry = 'AE', onCountryChange, countryLabel, countryNames,
    numerals = 'latn', label, help, error, errorMessages, id, name, placeholder, disabled, required, className,
  } = props
  const [ownCountry, setOwnCountry] = useState<GulfCountry>(defaultCountry)
  const picked = country ?? ownCountry
  const result = readGulfPhone(value, picked)
  const shown = useShownError(result, error, errorMessages)
  const mask: Mask = { ...PHONE_MASK, display: (v) => withNumerals(v, numerals) }
  const input = useMaskedInput(value, mask, (next) => {
    onChange(next)
    onResult?.(readGulfPhone(next, picked))
  })

  const pickCountry = (next: GulfCountry) => {
    if (country === undefined) setOwnCountry(next)
    onCountryChange?.(next)
    onResult?.(readGulfPhone(value, next))
  }

  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => (
        <div dir="ltr" className="flex gap-2">
          <select aria-label={countryLabel} className={SELECT} value={picked} disabled={disabled}
            onChange={(e) => pickCountry(e.currentTarget.value as GulfCountry)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{`${countryNames?.[c] ?? c} +${GULF_DIAL_CODES[c]}`}</option>
            ))}
          </select>
          <Input {...aria} {...input} dir="ltr" type="tel" inputMode="tel" autoComplete="tel-national"
            name={name} placeholder={placeholder} disabled={disabled} required={required}
            className="text-start" onBlur={shown.onBlur} />
        </div>
      )}
    </GulfField>
  )
}
