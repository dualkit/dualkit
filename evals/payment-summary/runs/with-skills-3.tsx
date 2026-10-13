import { useId, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { formatMoney, formatHijri, parseUaePhone, parseIban, toWesternDigits } from '@dualkit/format'

type Locale = 'en' | 'ar'

type PluralForms = Readonly<Record<Intl.LDMLPluralRule, string>>

interface Strings {
  readonly back: string
  readonly title: string
  readonly amountDue: string
  readonly dueDate: string
  readonly gregorian: string
  readonly hijri: string
  readonly items: PluralForms
  readonly phoneLabel: string
  readonly phoneHint: string
  readonly phoneError: string
  readonly ibanLabel: string
  readonly ibanHint: string
  readonly ibanError: string
  readonly secure: string
  readonly pay: string
}

// LRI / PDI isolates for left-to-right runs inside Arabic strings
const LRI = '⁦'
const PDI = '⁩'
const isolate = (value: string): string => `${LRI}${value}${PDI}`

const PHONE_EXAMPLE = '050 123 4567'
const IBAN_EXAMPLE = 'AE07 0331 2345 6789 0123 456'
const MAX_IBAN_LENGTH = 34
const TIME_ZONE = 'Asia/Dubai'
const AMOUNT_DUE = 1234.5
const CURRENCY = 'AED'

const STRINGS: Readonly<Record<Locale, Strings>> = {
  en: {
    back: 'Back',
    title: 'Payment summary',
    amountDue: 'Amount due',
    dueDate: 'Due date',
    gregorian: 'Gregorian',
    hijri: 'Hijri',
    items: {
      zero: 'You have {count} items in this order',
      one: 'You have {count} item in this order',
      two: 'You have {count} items in this order',
      few: 'You have {count} items in this order',
      many: 'You have {count} items in this order',
      other: 'You have {count} items in this order',
    },
    phoneLabel: 'Mobile number for your SMS receipt',
    phoneHint: `For example ${PHONE_EXAMPLE}`,
    phoneError: `Enter a valid UAE mobile number, for example ${PHONE_EXAMPLE}`,
    ibanLabel: 'IBAN for refunds',
    ibanHint: `For example ${IBAN_EXAMPLE}`,
    ibanError: 'Enter a valid UAE IBAN',
    secure: 'Secure checkout',
    pay: 'Pay now',
  },
  ar: {
    back: 'رجوع',
    title: 'ملخص الدفع',
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
    phoneLabel: 'رقم الجوال لاستلام الإيصال عبر رسالة نصية',
    phoneHint: `مثال: ${isolate(PHONE_EXAMPLE)}`,
    phoneError: `رقم الجوال الإماراتي غير صالح، مثال: ${isolate(PHONE_EXAMPLE)}`,
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanHint: `مثال: ${isolate(IBAN_EXAMPLE)}`,
    ibanError: 'رقم الآيبان الإماراتي غير صالح',
    secure: 'دفع آمن',
    pay: 'الدفع الآن',
  },
}

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

@font-face {
  font-family: 'Plex Arabic Adj';
  src: local('IBM Plex Sans Arabic');
  font-weight: 400 700;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
  size-adjust: 110%;
}

.payment-summary { font-family: 'Plex Arabic Adj', 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif; }
.payment-summary:lang(ar), .payment-summary :lang(ar) { letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }
`

function groupIban(raw: string): string {
  const compact = toWesternDigits(raw).replace(/\s+/g, '').toUpperCase().slice(0, MAX_IBAN_LENGTH)
  return compact.replace(/(.{4})/g, '$1 ').trim()
}

function pluralLine(locale: Locale, strings: Strings, count: number): string {
  const rule = new Intl.PluralRules(locale === 'ar' ? 'ar' : 'en').select(count)
  const number = new Intl.NumberFormat('en-US').format(count)
  const value = locale === 'ar' ? isolate(number) : number
  return strings.items[rule].replace('{count}', value)
}

function formatGregorian(date: Date, locale: Locale): string {
  const tag = locale === 'ar' ? 'ar-AE-u-ca-gregory-nu-latn' : 'en-GB-u-ca-gregory-nu-latn'
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

function BackArrow() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="rtl:-scale-x-100"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

interface FieldProps {
  readonly label: string
  readonly hint: string
  readonly error: string | null
  readonly value: string
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onBlur: () => void
  readonly inputMode: 'tel' | 'text'
  readonly autoComplete: string
  readonly placeholder: string
}

function Field(props: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const { label, hint, error, value, onChange, onBlur, inputMode, autoComplete, placeholder } = props
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        dir="ltr"
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : hintId}
        className={`h-12 w-full rounded-xl border bg-white px-4 text-start text-base tabular-nums text-slate-900 outline-none focus:ring-2 ${
          error !== null
            ? 'border-red-600 focus:ring-red-200'
            : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-200'
        }`}
      />
      {error !== null ? (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}
    </div>
  )
}

export interface PaymentSummaryProps {
  readonly locale: Locale
  readonly dueDate: Date
  readonly count: number
  readonly onBack?: () => void
  readonly onPay?: (payload: { readonly phone: string; readonly iban: string }) => void
}

export default function PaymentSummary({ locale, dueDate, count, onBack, onPay }: PaymentSummaryProps) {
  const t = STRINGS[locale]
  const [phone, setPhone] = useState('')
  const [iban, setIban] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [ibanTouched, setIbanTouched] = useState(false)

  const phoneResult = useMemo(() => parseUaePhone(toWesternDigits(phone)), [phone])
  const ibanResult = useMemo(() => parseIban(iban, { country: 'AE' }), [iban])

  const phoneValid = phoneResult.ok && phoneResult.value.type === 'mobile'
  const ibanValid = ibanResult.ok

  const phoneError = phoneTouched && !phoneValid ? t.phoneError : null
  const ibanError = ibanTouched && !ibanValid ? t.ibanError : null

  const amount = formatMoney(AMOUNT_DUE, { currency: CURRENCY, locale, numerals: 'latn' })
  const gregorian = formatGregorian(dueDate, locale)
  const hijri = formatHijri(dueDate, { locale, numerals: 'latn', timeZone: TIME_ZONE })
  const itemsLine = pluralLine(locale, t, count)

  const handlePay = () => {
    setPhoneTouched(true)
    setIbanTouched(true)
    if (!phoneResult.ok || phoneResult.value.type !== 'mobile' || !ibanResult.ok) return
    onPay?.({ phone: phoneResult.value.e164, iban: iban.replace(/\s+/g, '') })
  }

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      className="payment-summary mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 text-slate-900"
    >
      <style>{FONT_CSS}</style>

      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.back}
          className="flex h-12 w-12 items-center justify-center rounded-full text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          <BackArrow />
        </button>
        <h1 className="text-xl font-semibold">{t.title}</h1>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 pb-8">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">{t.amountDue}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            <bdi>{amount}</bdi>
          </p>

          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            <dt className="text-slate-600">{t.dueDate}</dt>
            <dd className="font-medium">
              <bdi>{gregorian}</bdi>
            </dd>
            <dt className="sr-only">{t.hijri}</dt>
            <dd className="col-start-2 text-slate-700">
              <bdi>{hijri}</bdi>
            </dd>
          </dl>

          <p className="mt-5 border-t border-slate-200 pt-4 text-base">{itemsLine}</p>
        </section>

        <section className="flex flex-col gap-5">
          <Field
            label={t.phoneLabel}
            hint={t.phoneHint}
            error={phoneError}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onBlur={() => setPhoneTouched(true)}
            inputMode="tel"
            autoComplete="tel"
            placeholder={locale === 'ar' ? isolate(PHONE_EXAMPLE) : PHONE_EXAMPLE}
          />
          <Field
            label={t.ibanLabel}
            hint={t.ibanHint}
            error={ibanError}
            value={iban}
            onChange={(event) => setIban(groupIban(event.target.value))}
            onBlur={() => setIbanTouched(true)}
            inputMode="text"
            autoComplete="off"
            placeholder={locale === 'ar' ? isolate(IBAN_EXAMPLE) : IBAN_EXAMPLE}
          />
        </section>

        <div className="mt-auto flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-600 rtl:tracking-normal rtl:normal-case">
            {t.secure}
          </p>
          <button
            type="button"
            onClick={handlePay}
            className="min-h-14 w-full rounded-xl bg-emerald-800 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            {t.pay}
          </button>
        </div>
      </main>
    </div>
  )
}
