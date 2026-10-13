import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { formatHijri, formatMoney, parseIban, parseUaePhone, toWesternDigits } from '@dualkit/format'

export type Locale = 'en' | 'ar'

export interface PaymentSummaryProps {
  locale: Locale
  dueDate: Date
  itemCount: number
  /** Amount due in AED. Defaults to 1234.5. */
  amount?: number
  /** Called with E.164 phone and compact IBAN once both are valid. */
  onPay?: (payload: { phoneE164: string; iban: string }) => void
  onBack?: () => void
}

const TIME_ZONE = 'Asia/Dubai'
const CURRENCY = 'AED'
const IBAN_COUNTRY = 'AE'
const IBAN_MAX_LENGTH = 23
const PHONE_EXAMPLE = '050 123 4567'
const IBAN_EXAMPLE = 'AE07 0331 2345 6789 0123 456'

/** One digit system for the whole product: Western digits, pinned explicitly. */
const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-GB-u-nu-latn',
  ar: 'ar-AE-u-nu-latn',
}

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

interface Strings {
  title: string
  back: string
  amountDue: string
  dueDate: string
  gregorian: string
  hijri: string
  items: PluralForms
  phoneLabel: string
  phonePlaceholder: string
  phoneError: string
  ibanLabel: string
  ibanPlaceholder: string
  ibanError: string
  eyebrow: string
  pay: string
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    title: 'Payment summary',
    back: 'Back',
    amountDue: 'Amount due',
    dueDate: 'Due date',
    gregorian: 'Gregorian',
    hijri: 'Hijri',
    items: {
      one: 'You have {count} item in this order',
      other: 'You have {count} items in this order',
    },
    phoneLabel: 'Send the receipt by SMS to',
    phonePlaceholder: PHONE_EXAMPLE,
    phoneError: 'Enter a valid UAE mobile number, for example {example}',
    ibanLabel: 'IBAN for refunds',
    ibanPlaceholder: IBAN_EXAMPLE,
    ibanError: 'Enter a valid UAE IBAN, for example {example}',
    eyebrow: 'Secure checkout',
    pay: 'Pay now',
  },
  ar: {
    title: 'ملخص الدفع',
    back: 'رجوع',
    amountDue: 'المبلغ المستحق',
    dueDate: 'تاريخ الاستحقاق',
    gregorian: 'ميلادي',
    hijri: 'هجري',
    items: {
      zero: 'لا توجد عناصر في هذا الطلب',
      one: 'لديك عنصر واحد في هذا الطلب',
      two: 'لديك عنصران في هذا الطلب',
      few: 'لديك {count} عناصر في هذا الطلب',
      many: 'لديك {count} عنصرًا في هذا الطلب',
      other: 'لديك {count} عنصر في هذا الطلب',
    },
    phoneLabel: 'رقم الجوال لإرسال الإيصال برسالة نصية',
    phonePlaceholder: PHONE_EXAMPLE,
    phoneError: 'رقم الجوال غير صالح. المطلوب رقم جوال إماراتي، مثال: {example}',
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanPlaceholder: IBAN_EXAMPLE,
    ibanError: 'رقم الآيبان غير صالح. المطلوب آيبان إماراتي، مثال: {example}',
    eyebrow: 'دفع آمن',
    pay: 'الدفع الآن',
  },
}

/** Fonts: a superfamily drawn for both scripts. Self-host the woff2 files under /fonts. */
const WEIGHTS = [400, 500, 600, 700] as const
const ARABIC_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF'

const FONT_CSS = [
  ...WEIGHTS.map(
    (w) => `@font-face{font-family:'Brand';font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url('/fonts/ibm-plex-sans-arabic-${w}.woff2') format('woff2');` +
      `unicode-range:${ARABIC_RANGE};size-adjust:110%;}`,
  ),
  ...WEIGHTS.map(
    (w) => `@font-face{font-family:'Brand';font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url('/fonts/ibm-plex-sans-${w}.woff2') format('woff2');}`,
  ),
  `.pay-root{font-family:'Brand','IBM Plex Sans','IBM Plex Sans Arabic',system-ui,sans-serif;}`,
  // Arabic: no tracking, no case, no italic, taller leading. Doubled selector beats utility classes.
  `.pay-root:lang(ar),.pay-root:lang(ar) *{letter-spacing:0;text-transform:none;font-style:normal;line-height:1.7;}`,
].join('\n')

/** Wrap a left-to-right run so it cannot reorder the surrounding sentence. */
const isolate = (value: string): string => `⁦${value}⁩`

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, isolate(value)),
    template,
  )
}

function pickPlural(forms: PluralForms, locale: Locale, count: number): string {
  const rule = new Intl.PluralRules(locale).select(count)
  return forms[rule] ?? forms.other
}

/** Group an IBAN in fours, accepting Arabic digits, lower case and pasted spaces. */
function normaliseIban(raw: string): { compact: string; display: string } {
  const compact = toWesternDigits(raw)
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .slice(0, IBAN_MAX_LENGTH)
  const display = compact.replace(/(.{4})(?=.)/g, '$1 ')
  return { compact, display }
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="rtl:-scale-x-100"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}

interface FieldProps {
  id: string
  label: string
  value: string
  placeholder: string
  error: string | null
  inputMode: 'tel' | 'text'
  autoComplete: string
  autoCapitalize?: 'characters' | 'off'
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
}

/** Left-to-right input; the label and error stay in the page direction. */
function Field(props: FieldProps) {
  const { id, label, value, placeholder, error, inputMode, autoComplete, autoCapitalize, onChange, onBlur } = props
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-start text-sm font-medium text-slate-700 rtl:text-base">
        {label}
      </label>
      <input
        id={id}
        dir="ltr"
        type="text"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
        onBlur={onBlur}
        className={`h-12 w-full rounded-xl bg-white px-4 text-start text-base tabular-nums text-slate-900 outline-none ring-1 placeholder:text-slate-400 focus-visible:ring-2 ${
          error ? 'ring-red-600 focus-visible:ring-red-600' : 'ring-slate-300 focus-visible:ring-emerald-700'
        }`}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-start text-sm text-red-700 rtl:text-base">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PaymentSummary({ locale, dueDate, itemCount, amount = 1234.5, onPay, onBack }: PaymentSummaryProps) {
  const t = STRINGS[locale]
  const isAr = locale === 'ar'
  const baseId = useId()

  const [phone, setPhone] = useState('')
  const [iban, setIban] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [ibanTouched, setIbanTouched] = useState(false)

  const phoneResult = parseUaePhone(phone)
  const phoneE164 = phoneResult.ok && phoneResult.value.type === 'mobile' ? phoneResult.value.e164 : null
  const ibanCompact = normaliseIban(iban).compact
  const ibanValid = parseIban(ibanCompact, { country: IBAN_COUNTRY }).ok

  const phoneError =
    phoneTouched && !phoneE164 ? interpolate(t.phoneError, { example: PHONE_EXAMPLE }) : null
  const ibanError =
    ibanTouched && !ibanValid ? interpolate(t.ibanError, { example: IBAN_EXAMPLE }) : null

  const formatted = useMemo(() => {
    const intlLocale = INTL_LOCALE[locale]
    return {
      amount: formatMoney(amount, { currency: CURRENCY, locale, numerals: 'latn' }),
      gregorian: new Intl.DateTimeFormat(intlLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TIME_ZONE,
      }).format(dueDate),
      hijri: formatHijri(dueDate, { locale, numerals: 'latn', timeZone: TIME_ZONE }),
      count: new Intl.NumberFormat(intlLocale).format(itemCount),
    }
  }, [locale, amount, dueDate, itemCount])

  const itemsLine = interpolate(pickPlural(t.items, locale, itemCount), { count: formatted.count })
  const canPay = Boolean(phoneE164) && ibanValid

  const handlePay = () => {
    setPhoneTouched(true)
    setIbanTouched(true)
    if (phoneE164 && ibanValid) onPay?.({ phoneE164, iban: ibanCompact })
  }

  return (
    <div
      lang={locale}
      dir={isAr ? 'rtl' : 'ltr'}
      className="pay-root mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 text-base text-slate-900"
    >
      <style>{FONT_CSS}</style>

      <header className="flex items-center gap-2 px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.back}
          className="flex h-12 w-12 items-center justify-center rounded-full text-slate-800 outline-none ring-1 ring-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <BackIcon />
        </button>
        <h1 className="text-start text-xl font-semibold rtl:text-2xl">{t.title}</h1>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 pb-8">
        <section className="flex flex-col gap-2 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <p className="text-start text-sm text-slate-600 rtl:text-base">{t.amountDue}</p>
          <p className="text-start text-4xl font-bold tabular-nums rtl:text-5xl">
            <bdi>{formatted.amount}</bdi>
          </p>

          <dl className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-start text-sm text-slate-600 rtl:text-base">{t.dueDate}</dt>
              <dd className="text-end font-medium tabular-nums">
                <bdi>{formatted.gregorian}</bdi>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-start text-sm text-slate-600 rtl:text-base">{t.hijri}</dt>
              <dd className="text-end font-medium tabular-nums">
                <bdi>{formatted.hijri}</bdi>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-start text-base text-slate-700">{itemsLine}</p>
        </section>

        <section className="flex flex-col gap-5">
          <Field
            id={`${baseId}-phone`}
            label={t.phoneLabel}
            value={phone}
            placeholder={t.phonePlaceholder}
            error={phoneError}
            inputMode="tel"
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
            onBlur={() => setPhoneTouched(true)}
          />
          <Field
            id={`${baseId}-iban`}
            label={t.ibanLabel}
            value={iban}
            placeholder={t.ibanPlaceholder}
            error={ibanError}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(event) => setIban(normaliseIban(event.target.value).display)}
            onBlur={() => setIbanTouched(true)}
          />
        </section>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-500 rtl:text-sm rtl:normal-case rtl:tracking-normal">
            {t.eyebrow}
          </p>
          <button
            type="button"
            onClick={handlePay}
            aria-disabled={!canPay}
            className={`h-14 w-full rounded-2xl px-6 text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${
              canPay ? 'bg-emerald-800' : 'cursor-not-allowed bg-slate-400'
            }`}
          >
            {t.pay}
          </button>
        </div>
      </main>
    </div>
  )
}

export default PaymentSummary
