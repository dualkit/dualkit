import React, { useId, useMemo, useState } from 'react';

/*
 * Fonts: add to your app shell (index.html or layout):
 *   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
 * Tailwind: no config needed, font families are applied inline below.
 */

type Locale = 'en' | 'ar';

export interface PaymentSummaryProps {
  locale: Locale;
  dueDate: Date;
  itemCount: number;
  amountDue?: number;
  onBack?: () => void;
  onPay?: (payload: { phone: string; iban: string }) => void;
}

type PluralKey = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

interface Strings {
  title: string;
  back: string;
  amountDue: string;
  dueDate: string;
  gregorian: string;
  hijri: string;
  items: Partial<Record<PluralKey, string>> & { other: string };
  phoneLabel: string;
  phoneHint: string;
  phoneError: string;
  ibanLabel: string;
  ibanHint: string;
  ibanError: string;
  secure: string;
  pay: string;
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
    phoneLabel: 'Mobile number for SMS receipt',
    phoneHint: 'Example: 50 123 4567',
    phoneError: 'Enter a valid UAE mobile number, for example 050 123 4567.',
    ibanLabel: 'IBAN for refunds',
    ibanHint: 'Example: AE07 0331 2345 6789 0123 456',
    ibanError: 'Enter a valid UAE IBAN (23 characters, starts with AE).',
    secure: 'SECURE CHECKOUT',
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
      zero: 'ليس لديك أي عناصر في هذا الطلب',
      one: 'لديك عنصر واحد في هذا الطلب',
      two: 'لديك عنصران في هذا الطلب',
      few: 'لديك {count} عناصر في هذا الطلب',
      many: 'لديك {count} عنصرًا في هذا الطلب',
      other: 'لديك {count} عنصر في هذا الطلب',
    },
    phoneLabel: 'رقم الجوال لإرسال الإيصال برسالة نصية',
    phoneHint: 'مثال: 50 123 4567',
    phoneError: 'أدخل رقم جوال إماراتي صحيحًا، مثال 050 123 4567.',
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanHint: 'مثال: AE07 0331 2345 6789 0123 456',
    ibanError: 'أدخل رقم آيبان إماراتي صحيحًا (23 خانة ويبدأ بـ AE).',
    secure: 'دفع آمن',
    pay: 'ادفع الآن',
  },
};

const INTL_LOCALE: Record<Locale, string> = { en: 'en-AE', ar: 'ar-AE' };
const FONT_FAMILY: Record<Locale, string> = {
  en: "'Inter', system-ui, sans-serif",
  ar: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
};

const DEFAULT_AMOUNT_AED = 1234.5;
const UAE_IBAN_LENGTH = 23;

/* ---------- validation helpers ---------- */

/** Converts Arabic-Indic and Persian digits to ASCII so validation works on any keyboard. */
function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * UAE mobile: optional +971 / 00971 / 0 prefix, then 5X (50, 52, 54, 55, 56, 58) and 7 digits.
 */
export function isValidUaeMobile(input: string): boolean {
  const cleaned = toAsciiDigits(input).replace(/[\s\-()]/g, '');
  return /^(?:\+971|00971|971|0)?5[024568]\d{7}$/.test(cleaned);
}

/** UAE IBAN: AE + 2 check digits + 3 bank code + 16 account digits, ISO 7064 mod 97-10. */
export function isValidUaeIban(input: string): boolean {
  const iban = toAsciiDigits(input).replace(/\s/g, '').toUpperCase();
  if (iban.length !== UAE_IBAN_LENGTH || !/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function formatIban(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, UAE_IBAN_LENGTH)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/* ---------- small pieces ---------- */

function ArrowIcon({ mirrored }: { mirrored: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={mirrored ? 'scale-x-[-1]' : undefined}
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

interface FieldProps {
  label: string;
  hint: string;
  error: string;
  showError: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputMode: 'tel' | 'text';
  autoComplete: string;
  placeholder: string;
  prefix?: string;
}

function Field({
  label,
  hint,
  error,
  showError,
  value,
  onChange,
  onBlur,
  inputMode,
  autoComplete,
  placeholder,
  prefix,
}: FieldProps) {
  const id = useId();
  const describedBy = showError ? `${id}-error` : `${id}-hint`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-xl bg-white px-4 ring-1 transition-colors focus-within:ring-2 ${
          showError
            ? 'ring-red-600 focus-within:ring-red-600'
            : 'ring-neutral-300 focus-within:ring-emerald-700'
        }`}
      >
        {prefix ? (
          <span dir="ltr" className="text-neutral-500">
            {prefix}
          </span>
        ) : null}
        {/* Numbers and IBANs always read left to right, even inside Arabic */}
        <input
          id={id}
          dir="ltr"
          type="text"
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={showError}
          aria-describedby={describedBy}
          className="h-12 w-full bg-transparent text-start text-base text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </div>
      {showError ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ---------- component ---------- */

export default function PaymentSummary({
  locale,
  dueDate,
  itemCount,
  amountDue = DEFAULT_AMOUNT_AED,
  onBack,
  onPay,
}: PaymentSummaryProps) {
  const t = STRINGS[locale];
  const intlLocale = INTL_LOCALE[locale];
  const isRtl = locale === 'ar';

  const [phone, setPhone] = useState('');
  const [iban, setIban] = useState('');
  const [touched, setTouched] = useState({ phone: false, iban: false });

  const formatted = useMemo(() => {
    const amount = new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'AED',
      currencyDisplay: 'code',
    }).format(amountDue);

    const dateOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const gregorian = new Intl.DateTimeFormat(`${intlLocale}-u-ca-gregory`, dateOptions).format(dueDate);
    const hijri = new Intl.DateTimeFormat(`${intlLocale}-u-ca-islamic-umalqura`, dateOptions).format(dueDate);

    const pluralKey = new Intl.PluralRules(intlLocale).select(itemCount) as PluralKey;
    const template = (itemCount === 0 && t.items.zero) || t.items[pluralKey] || t.items.other;
    const count = new Intl.NumberFormat(intlLocale).format(itemCount);

    return { amount, gregorian, hijri, itemsLine: template.replace('{count}', count) };
  }, [amountDue, dueDate, intlLocale, itemCount, t]);

  const phoneValid = isValidUaeMobile(phone);
  const ibanValid = isValidUaeIban(iban);
  const phoneError = touched.phone && !phoneValid;
  const ibanError = touched.iban && !ibanValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ phone: true, iban: true });
    if (phoneValid && ibanValid) {
      onPay?.({
        phone: toAsciiDigits(phone).replace(/[\s\-()]/g, ''),
        iban: iban.replace(/\s/g, ''),
      });
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={locale}
      style={{ fontFamily: FONT_FAMILY[locale] }}
      className="mx-auto min-h-screen w-full max-w-md bg-neutral-50 text-neutral-900"
    >
      <header className="flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.back}
          className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 ring-1 ring-neutral-300 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <ArrowIcon mirrored={isRtl} />
        </button>
        <h1 className="text-lg font-semibold">{t.title}</h1>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 px-4 pb-8">
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 ring-1 ring-neutral-200">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-500">{t.amountDue}</span>
            <span className="text-4xl font-semibold tabular-nums">{formatted.amount}</span>
          </div>

          <dl className="flex flex-col gap-2 border-t border-neutral-200 pt-4 text-sm">
            <dt className="text-neutral-500">{t.dueDate}</dt>
            <dd className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{formatted.gregorian}</span>
              <span className="text-neutral-500">{t.gregorian}</span>
            </dd>
            <dd className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{formatted.hijri}</span>
              <span className="text-neutral-500">{t.hijri}</span>
            </dd>
          </dl>

          <p className="border-t border-neutral-200 pt-4 text-base text-neutral-700">{formatted.itemsLine}</p>
        </section>

        <section className="flex flex-col gap-5">
          <Field
            label={t.phoneLabel}
            hint={t.phoneHint}
            error={t.phoneError}
            showError={phoneError}
            value={phone}
            onChange={setPhone}
            onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="50 123 4567"
            prefix="+971"
          />
          <Field
            label={t.ibanLabel}
            hint={t.ibanHint}
            error={t.ibanError}
            showError={ibanError}
            value={iban}
            onChange={(v) => setIban(formatIban(v))}
            onBlur={() => setTouched((s) => ({ ...s, iban: true }))}
            inputMode="text"
            autoComplete="off"
            placeholder="AE07 0331 2345 6789 0123 456"
          />
        </section>

        <div className="flex flex-col gap-3 pt-2">
          <span className="text-xs font-medium uppercase text-neutral-500">{t.secure}</span>
          <button
            type="submit"
            className="h-14 w-full rounded-2xl bg-emerald-800 px-6 text-base font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:bg-emerald-950"
          >
            {t.pay}
          </button>
        </div>
      </form>
    </div>
  );
}
