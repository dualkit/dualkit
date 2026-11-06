import { formatMoney, toWesternDigits, type Currency, type Locale, type Numerals, type Result } from '@dualkit/format'
import { Input } from '@/components/ui/input'
import { GulfField, cx, LTR_PLACEHOLDER, useMaskedInput, useShownError, withNumerals, type GulfFieldText } from './gulf-field'

export type GulfAmountError = 'empty' | 'invalid_number' | 'too_large' | 'too_many_decimals'
export type GulfAmountValue = { readonly amount: number; readonly formatted: string }
export type GulfAmountResult = Result<GulfAmountValue, GulfAmountError>
export type GulfAmountOptions = {
  readonly currency: Currency
  readonly locale?: Locale
  readonly numerals?: Numerals
  /** Accept a leading minus. Off by default, so a stray hyphen is never read as a negative amount. */
  readonly allowNegative?: boolean
}

const NBSP = ' '
const err = (code: GulfAmountError, message: string): GulfAmountResult => ({ ok: false, error: { code, message } })

/** How many decimals the currency shows, read from format: two for AED, SAR and QAR, three for the dinars and the rial. */
const decimalsOf = (currency: Currency): number => formatMoney(0, { currency }).split('.')[1]?.length ?? 0

/** The code in English and format's Arabic abbreviation in Arabic, which is the part of formatMoney's output that is not the number. */
function currencyMark(currency: Currency, locale: Locale): string {
  const parts = formatMoney(0, { currency, locale }).split(NBSP)
  return (locale === 'ar' ? parts[parts.length - 1] : parts[0]) ?? currency
}

/** Whole parts past 15 digits lose precision as a JavaScript number and can print with an exponent. */
const MAX_WHOLE_DIGITS = 15
/** An optional minus, a whole part that is plain digits or grouped in threes with commas, and an optional fraction. */
const AMOUNT = /^(-?)(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/

/**
 * Reads a typed amount. format has no amount parser yet, so this only turns the text into a number,
 * checks it against the currency's decimals, and leaves the formatting to formatMoney.
 * A comma is read only as thousands grouping, so "12,5" is refused rather than read as 125.
 */
export function readGulfAmount(value: string, options: GulfAmountOptions): GulfAmountResult {
  const { currency, locale = 'en', numerals = 'latn', allowNegative = false } = options
  const text = toWesternDigits(value).replace(/\s/g, '')
  if (text === '') return err('empty', 'Enter an amount.')
  const match = AMOUNT.exec(text)
  const [, sign = '', whole = '', fraction] = match ?? []
  if (!match || (whole === '' && !fraction) || (sign !== '' && !allowNegative)) {
    return err('invalid_number', 'Enter an amount in digits.')
  }
  const digits = whole.replace(/,/g, '')
  if (digits.length > MAX_WHOLE_DIGITS) return err('too_large', `Enter at most ${MAX_WHOLE_DIGITS} digits before the decimal point.`)
  const decimals = decimalsOf(currency)
  if ((fraction ?? '').length > decimals) return err('too_many_decimals', `${currency} has ${decimals} decimal places.`)
  const parsed = Number(`${sign}${digits}${fraction ? `.${fraction}` : ''}`)
  const amount = parsed === 0 ? 0 : parsed // -0 reads as 0.
  return { ok: true, value: { amount, formatted: formatMoney(amount, { currency, locale, numerals }) } }
}

export type GulfAmountProps = GulfFieldText<GulfAmountError> & GulfAmountOptions & {
  /** What was typed, with Western digits and a full stop for the decimal point. */
  value: string
  onChange: (value: string) => void
  onResult?: (result: GulfAmountResult) => void
}

/** Digits, the point and grouping commas; a minus only at the start, and only when negatives are allowed. */
function keepAmountCharacters(raw: string, allowNegative: boolean): string {
  const kept = toWesternDigits(raw).replace(/[^\d.,-]/g, '')
  const negative = allowNegative && kept.startsWith('-')
  return `${negative ? '-' : ''}${kept.replace(/-/g, '')}`
}

const MARK = 'text-muted-foreground flex items-center px-3 text-sm'

/** An amount in a Gulf currency. English puts the code first; Arabic puts the abbreviation after the number. */
export function GulfAmount(props: GulfAmountProps) {
  const {
    value, onChange, onResult, currency, locale = 'en', numerals = 'latn', allowNegative = false,
    label, help, error, errorMessages, id, name, placeholder, disabled, required, className,
  } = props
  const options = { currency, locale, numerals, allowNegative }
  const result = readGulfAmount(value, options)
  const shown = useShownError(result, error, errorMessages)
  const commit = (next: string) => {
    onChange(next)
    onResult?.(readGulfAmount(next, options))
  }
  const input = useMaskedInput(value, {
    normalize: (raw) => keepAmountCharacters(raw, allowNegative),
    display: (v) => withNumerals(v, numerals),
  }, commit)

  const onBlur = () => {
    shown.onBlur()
    if (!result.ok) return
    const padded = result.value.amount.toFixed(decimalsOf(currency))
    if (padded !== value) commit(padded)
  }

  return (
    <GulfField id={id} label={label} help={help} error={shown.error} className={className}>
      {(aria) => {
        const markId = `${aria.id}-currency`
        const mark = <span id={markId} className={MARK}>{currencyMark(currency, locale)}</span>
        return (
        <div className="grid gap-1">
          <div className={cx('border-input flex rounded-md border shadow-xs', 'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]')}>
            {locale === 'en' && mark}
            <Input {...aria} aria-describedby={cx(markId, aria['aria-describedby'])} {...input} dir="ltr" inputMode="decimal" autoComplete="off"
              name={name} placeholder={placeholder} disabled={disabled} required={required}
              className={cx('border-0 shadow-none focus-visible:ring-0 text-start tabular-nums', LTR_PLACEHOLDER)} onBlur={onBlur} />
            {locale === 'ar' && mark}
          </div>
          {result.ok && (
            <output htmlFor={aria.id} aria-live="off" className="text-muted-foreground text-sm">
              <bdi>{result.value.formatted}</bdi>
            </output>
          )}
        </div>
        )
      }}
    </GulfField>
  )
}
