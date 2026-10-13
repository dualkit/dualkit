import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  formatHijri,
  formatMoney,
  parseIban,
  parseUaePhone,
  toWesternDigits,
} from '@dualkit/format'

type Locale = 'en' | 'ar'
type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
type FieldError = 'phoneInvalid' | 'ibanInvalid' | null

export interface PaymentSummaryProps {
  locale: Locale
  /** Amount due in AED. */
  amountDue?: number
  dueDate: Date
  count: number
  onBack?: () => void
  onPay?: (payload: { phoneE164: string | null; iban: string | null }) => void
}

const TIME_ZONE = 'Asia/Dubai'
const CURRENCY = 'AED'
const DEFAULT_AMOUNT_DUE = 1234.5
const PHONE_EXAMPLE = '050 123 4567'
const IBAN_EXAMPLE = 'AE07 0331 2345 6789 0123 456'

/* ---------- Copy: keys identical in en and ar ---------- */

interface Copy {
  back: string
  title: string
  amountDue: string
  dueDate: string
  gregorian: string
  hijri: string
  items: Record<PluralForm, string>
  phoneLabel: string
  phoneHint: string
  phoneInvalid: string
  ibanLabel: string
  ibanHint: string
  ibanInvalid: string
  secure: string
  pay: string
}

const COPY: Record<Locale, Copy> = {
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
    phoneHint: 'For example {example}',
    phoneInvalid: 'Enter a valid UAE mobile number, for example {example}',
    ibanLabel: 'IBAN for refunds',
    ibanHint: 'For example {example}',
    ibanInvalid: 'Enter a valid UAE IBAN, for example {example}',
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
    phoneLabel: 'رقم الجوال لإرسال الإيصال برسالة نصية',
    phoneHint: 'مثال: {example}',
    phoneInvalid: 'أدخل رقم جوال إماراتي صحيحًا، مثال: {example}',
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanHint: 'مثال: {example}',
    ibanInvalid: 'أدخل رقم آيبان إماراتي صحيحًا، مثال: {example}',
    secure: 'دفع آمن',
    pay: 'الدفع الآن',
  },
}

/* ---------- Fonts: Arabic as its own face, scoped by unicode-range ---------- */

const ARABIC_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF'

const arabicFace = (weight: number) => `
@font-face {
  font-family: 'PS Brand';
  font-weight: ${weight};
  font-display: swap;
  src: local('IBM Plex Sans Arabic'),
       url('https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans-arabic@latest/arabic-${weight}-normal.woff2') format('woff2');
  unicode-range: ${ARABIC_RANGE};
  size-adjust: 110%;
}`

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
${[400, 500, 600, 700].map(arabicFace).join('\n')}
.ps-root { font-family: 'PS Brand', 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif; }
.ps-root :lang(ar), .ps-root:lang(ar) { letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }
.ps-root:lang(ar) .ps-eyebrow { text-transform: none; letter-spacing: 0; }
`

/* ---------- Helpers ---------- */

function renderTemplate(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part)
    return <Fragment key={index}>{match ? (values[match[1]] ?? part) : part}</Fragment>
  })
}

function normalizeIban(raw: string): string {
  return toWesternDigits(raw).replace(/\s+/g, '').toUpperCase()
}

function groupIban(compact: string): string {
  return compact.replace(/(.{4})/g, '$1 ').trim()
}

function validatePhone(raw: string): FieldError {
  const value = toWesternDigits(raw).trim()
  if (value === '') return null
  const result = parseUaePhone(value)
  return result.ok && result.value.type === 'mobile' ? null : 'phoneInvalid'
}

function validateIban(raw: string): FieldError {
  const compact = normalizeIban(raw)
  if (compact === '') return null
  return parseIban(compact, { country: 'AE' }).ok ? null : 'ibanInvalid'
}

function BackArrow() {
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

/* ---------- Component ---------- */

export default function PaymentSummary({
  locale,
  amountDue = DEFAULT_AMOUNT_DUE,
  dueDate,
  count,
  onBack,
  onPay,
}: PaymentSummaryProps) {
  const t = COPY[locale]
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const ids = { phone: useId(), iban: useId() }

  const [phone, setPhone] = useState('')
  const [iban, setIban] = useState('')
  const [touched, setTouched] = useState({ phone: false, iban: false })

  // Direction and language live on the document root as well.
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const phoneError = validatePhone(phone)
  const ibanError = validateIban(iban)

  const amountText = useMemo(
    () => formatMoney(amountDue, { currency: CURRENCY, locale, numerals: 'latn' }),
    [amountDue, locale],
  )

  const gregorianText = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE-u-ca-gregory-nu-latn' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TIME_ZONE,
      }).format(dueDate),
    [dueDate, locale],
  )

  const hijriText = useMemo(
    () => formatHijri(dueDate, { locale, numerals: 'latn', timeZone: TIME_ZONE }),
    [dueDate, locale],
  )

  const form = new Intl.PluralRules(locale).select(count) as PluralForm
  const countText = new Intl.NumberFormat('en-US', { useGrouping: false }).format(count)
  const itemsLine = renderTemplate(t.items[form], { count: <bdi>{countText}</bdi> })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ phone: true, iban: true })
    if (phoneError || ibanError) return
    const phoneResult = phone.trim() ? parseUaePhone(toWesternDigits(phone)) : null
    onPay?.({
      phoneE164: phoneResult && phoneResult.ok ? phoneResult.value.e164 : null,
      iban: iban.trim() ? normalizeIban(iban) : null,
    })
  }

  const phoneShown = touched.phone ? phoneError : null
  const ibanShown = touched.iban ? ibanError : null

  const inputClass = (invalid: boolean) =>
    [
      'w-full rounded-xl border bg-white px-4 py-3 text-base text-start tabular-nums',
      'text-slate-900 placeholder:text-slate-400 outline-none',
      'focus:ring-2 focus:ring-emerald-600',
      invalid ? 'border-red-600' : 'border-slate-300',
    ].join(' ')

  return (
    <div
      dir={dir}
      lang={locale}
      className="ps-root mx-auto w-full max-w-md bg-slate-50 px-4 pb-8 text-base text-slate-900 min-h-screen"
    >
      <style>{FONT_CSS}</style>

      <header className="flex items-center gap-2 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.back}
          className="-ms-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-900 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-600 outline-none"
        >
          <BackArrow />
        </button>
        <h1 className="text-xl font-semibold">{t.title}</h1>
      </header>

      <section className="rounded-2xl bg-white p-5 border border-slate-200">
        <p className="text-sm text-slate-600">{t.amountDue}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          <bdi>{amountText}</bdi>
        </p>

        <dl className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-base">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-600">{t.dueDate}</dt>
            <dd className="text-end font-medium tabular-nums">
              <span className="block">
                <bdi>{gregorianText}</bdi>
              </span>
              <span className="block text-sm text-slate-600">
                <span>{t.hijri}: </span>
                <bdi>{hijriText}</bdi>
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-base text-slate-700">{itemsLine}</p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor={ids.phone} className="mb-2 block text-sm font-medium">
            {t.phoneLabel}
          </label>
          <input
            id={ids.phone}
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={PHONE_EXAMPLE}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
            aria-invalid={phoneShown !== null}
            aria-describedby={`${ids.phone}-msg`}
            className={inputClass(phoneShown !== null)}
          />
          <p
            id={`${ids.phone}-msg`}
            role={phoneShown ? 'alert' : undefined}
            className={`mt-2 text-sm ${phoneShown ? 'text-red-700' : 'text-slate-600'}`}
          >
            {renderTemplate(phoneShown ? t.phoneInvalid : t.phoneHint, {
              example: <bdi dir="ltr">{PHONE_EXAMPLE}</bdi>,
            })}
          </p>
        </div>

        <div>
          <label htmlFor={ids.iban} className="mb-2 block text-sm font-medium">
            {t.ibanLabel}
          </label>
          <input
            id={ids.iban}
            dir="ltr"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={IBAN_EXAMPLE}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, iban: true }))
              const compact = normalizeIban(iban)
              if (compact) setIban(groupIban(compact))
            }}
            aria-invalid={ibanShown !== null}
            aria-describedby={`${ids.iban}-msg`}
            className={inputClass(ibanShown !== null)}
          />
          <p
            id={`${ids.iban}-msg`}
            role={ibanShown ? 'alert' : undefined}
            className={`mt-2 text-sm ${ibanShown ? 'text-red-700' : 'text-slate-600'}`}
          >
            {renderTemplate(ibanShown ? t.ibanInvalid : t.ibanHint, {
              example: <bdi dir="ltr">{IBAN_EXAMPLE}</bdi>,
            })}
          </p>
        </div>

        <div className="pt-2">
          <p className="ps-eyebrow mb-2 text-sm font-medium uppercase tracking-widest text-slate-600 rtl:tracking-normal rtl:normal-case">
            {t.secure}
          </p>
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-700 px-6 py-4 text-base font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 outline-none"
          >
            {t.pay}
          </button>
        </div>
      </form>
    </div>
  )
}
