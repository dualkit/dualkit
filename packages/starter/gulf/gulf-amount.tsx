import { formatMoney, toWesternDigits, type Currency, type Locale, type Numerals, type Result } from '@dualkit/format'
import { Input } from '@/components/ui/input'
import { GulfField, cx, useMaskedInput, useShownError, withNumerals, type GulfFieldText, type Mask } from './gulf-field'

export type GulfAmountError = 'empty' | 'invalid_number' | 'too_many_decimals'
export type GulfAmountValue = { readonly amount: number; readonly formatted: string }
export type GulfAmountResult = Result<GulfAmountValue, GulfAmountError>
export type GulfAmountOptions = { readonly currency: Currency; readonly locale?: Locale; readonly numerals?: Numerals }

const NBSP = ' '
const err = (code: GulfAmountError, message: string): GulfAmountResult => ({ ok: false, error: { code, message } })

/** How many decimals the currency shows, read from format: two for AED, SAR and QAR, three for the dinars and the rial. */
const decimalsOf = (currency: Currency): number => formatMoney(0, { currency }).split('.')[1]?.length ?? 0

/** The code in English and format's Arabic abbreviation in Arabic, which is the part of formatMoney's output that is not the number. */
function currencyMark(currency: Currency, locale: Locale): string {
  const parts = formatMoney(0, { currency, locale }).split(NBSP)
  return (locale === 'ar' ? parts[parts.length - 1] : parts[0]) ?? currency
}

/**
 * Reads a typed amount. format has no amount parser yet, so this only turns the text into a number,
 * checks the decimals against the currency, and leaves the formatting to formatMoney.
 */
export function readGulfAmount(value: string, options: GulfAmountOptions): GulfAmountResult {
  const { currency, locale = 'en', numerals = 'latn' } = options
  const text = toWesternDigits(value).replace(/[\s,]/g, '')
  if (text === '') return err('empty', 'Enter an amount.')
  const match = /^-?(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (match[1] === '' && !match[2])) return err('invalid_number', 'Enter an amount in digits.')
  const decimals = decimalsOf(currency)
  if ((match[2] ?? '').length > decimals) return err('too_many_decimals', `${currency} has ${decimals} decimal places.`)
  const amount = Number(text)
  return { ok: true, value: { amount, formatted: formatMoney(amount, { currency, locale, numerals }) } }
}

export type GulfAmountProps = GulfFieldText<GulfAmountError> & GulfAmountOptions & {
  /** What was typed, with Western digits and a full stop for the decimal point. */
  value: string
  onChange: (value: string) => void
  onResult?: (result: GulfAmountResult) => void
}

const AMOUNT_MASK: Mask = {
  normalize: (raw) => toWesternDigits(raw).replace(/[^\d.,-]/g, ''),
  display: (value) => value,
}

const MARK = 'text-muted-foreground flex items-center px-3 text-sm'

/** An amount in a Gulf currency. English puts the code first; Arabic puts the abbreviation after the number. */
export function GulfAmount(props: GulfAmountProps) {
  const {
    value, onChange, onResult, currency, locale = 'en', numerals = 'latn',
    label, help, error, errorMessages, id, name, placeholder, disabled, required, className,
  } = props
  const options = { currency, locale, numerals }
  const result = readGulfAmount(value, options)
  const shown = useShownError(result, error, errorMessages)
  const commit = (next: string) => {
    onChange(next)
    onResult?.(readGulfAmount(next, options))
  }
  const input = useMaskedInput(value, { ...AMOUNT_MASK, display: (v) => withNumerals(v, numerals) }, commit)

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
              className="border-0 shadow-none focus-visible:ring-0 text-start tabular-nums" onBlur={onBlur} />
            {locale === 'ar' && mark}
          </div>
          {result.ok && (
            <output htmlFor={aria.id} className="text-muted-foreground text-sm">
              <bdi>{result.value.formatted}</bdi>
            </output>
          )}
        </div>
        )
      }}
    </GulfField>
  )
}
