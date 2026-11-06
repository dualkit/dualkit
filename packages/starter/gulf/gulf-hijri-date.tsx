import {
  formatHijri, toHijri, toWesternDigits,
  type HijriDate, type Locale, type Numerals, type Result,
} from '@dualkit/format'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { GulfField, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfDateError = 'empty' | 'invalid_format' | 'invalid_date'
export type GulfDateValue = {
  readonly iso: string
  /** Midday of that calendar day in the time zone. */
  readonly date: Date
  readonly hijri: HijriDate
}
export type GulfDateResult = Result<GulfDateValue, GulfDateError>

const DAY = 86_400_000
const err = (code: GulfDateError, message: string): GulfDateResult => ({ ok: false, error: { code, message } })
const pad = (n: number): string => String(n).padStart(2, '0')

/** The calendar day a moment falls on in a time zone, as a UTC midnight. en-US is used only for its digits. */
function dayIn(moment: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(moment)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'))
}

/**
 * Reads a typed YYYY-MM-DD date as that calendar day in the time zone, and gives its Umm al-Qura date from format's toHijri.
 * The time zone is required, as toHijri requires it.
 */
export function readGulfDate(value: string, options: { readonly timeZone: string }): GulfDateResult {
  const { timeZone } = options
  const text = toWesternDigits(value).trim()
  if (text === '') return err('empty', 'Enter a date.')
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (!match) return err('invalid_format', 'Write the date as YYYY-MM-DD.')
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const target = Date.UTC(year, month - 1, day)
  const check = new Date(target)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return err('invalid_date', 'This date does not exist.')
  }
  const noon = new Date(target + DAY / 2)
  toHijri(noon, { timeZone }) // Throws format's own error when the time zone is missing.
  const date = new Date(noon.getTime() + (target - dayIn(noon, timeZone)))
  return { ok: true, value: { iso: `${year}-${pad(month)}-${pad(day)}`, date, hijri: toHijri(date, { timeZone }) } }
}

const DATE_MASK: Mask = {
  normalize: (raw) => toWesternDigits(raw).replace(/[^\d-]/g, '').slice(0, 10),
  display: (value) => value,
}

export type GulfHijriDateProps = GulfFieldText<GulfDateError> & {
  /** YYYY-MM-DD with Western digits. */
  value: string
  onChange: (value: string) => void
  onResult?: (result: GulfDateResult) => void
  /** Required: the day is read in this zone, such as "Asia/Dubai" or "Asia/Riyadh". */
  timeZone: string
  locale?: Locale
  numerals?: Numerals
  /** Optional captions for the two dates, in the page language. */
  calendarLabels?: { readonly gregorian?: ReactNode; readonly hijri?: ReactNode }
}

const gregorianText = (date: Date, locale: Locale, numerals: Numerals, timeZone: string): string =>
  new Intl.DateTimeFormat(`${locale === 'ar' ? 'ar' : 'en-GB'}-u-ca-gregory-nu-${numerals}`, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone,
  }).format(date)

function Line({ caption, text }: { caption: ReactNode; text: string }) {
  return (
    <span className="flex items-baseline gap-2">
      {caption != null && <span className="text-muted-foreground text-xs">{caption}</span>}
      <bdi className="text-foreground">{text}</bdi>
    </span>
  )
}

/** A date typed once and shown in both calendars, Gregorian and Umm al-Qura Hijri, side by side. */
export function GulfHijriDate(props: GulfHijriDateProps) {
  const {
    value, onChange, onResult, timeZone, locale = 'en', numerals = 'latn', calendarLabels,
    label, help, error, errorMessages, id, name, placeholder, disabled, required, className,
  } = props
  const result = readGulfDate(value, { timeZone })
  const shown = useShownError(result, error, errorMessages)
  const input = useMaskedInput(value, { ...DATE_MASK, display: (v) => withNumerals(v, numerals) }, (next) => {
    onChange(next)
    onResult?.(readGulfDate(next, { timeZone }))
  })

  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => (
        <div className="grid gap-1">
          <Input {...aria} {...input} dir="ltr" inputMode="numeric" autoComplete="off"
            name={name} placeholder={placeholder} disabled={disabled} required={required}
            className="text-start tabular-nums" onBlur={shown.onBlur} />
          {result.ok && (
            <output htmlFor={aria.id} className="text-sm">
              <time dateTime={result.value.iso} className="flex flex-wrap gap-x-4 gap-y-1">
                <Line caption={calendarLabels?.gregorian} text={gregorianText(result.value.date, locale, numerals, timeZone)} />
                <Line caption={calendarLabels?.hijri} text={formatHijri(result.value.date, { timeZone, locale, numerals })} />
              </time>
            </output>
          )}
        </div>
      )}
    </GulfField>
  )
}
