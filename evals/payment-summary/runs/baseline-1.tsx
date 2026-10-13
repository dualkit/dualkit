import { useId, useMemo, useState } from 'react';

/*
 * Fonts: add once in your app shell (index.html or layout):
 * <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
 */

type Locale = 'en' | 'ar';

interface PaymentSummaryProps {
  locale: Locale;
  dueDate: Date;
  itemCount: number;
  amountDue?: number;
  currency?: string;
  onBack?: () => void;
  onPay?: (payload: { phone: string; iban: string }) => void;
}

const DEFAULT_AMOUNT = 1234.5;

const STRINGS = {
  en: {
    title: 'Payment summary',
    back: 'Go back',
    amountDue: 'Amount due',
    dueDate: 'Due date',
    hijri: 'Hijri',
    gregorian: 'Gregorian',
    phoneLabel: 'Mobile number for SMS receipt',
    phoneHint: 'UAE mobile, for example 050 123 4567',
    phoneError: 'Enter a valid UAE mobile number (050, 052, 054, 055, 056 or 058).',
    ibanLabel: 'IBAN for refunds',
    ibanHint: 'UAE IBAN, 23 characters, starts with AE',
    ibanError: 'Enter a valid UAE IBAN.',
    secure: 'Secure checkout',
    pay: 'Pay now',
    items: {
      zero: 'You have {count} items in this order',
      one: 'You have {count} item in this order',
      two: 'You have {count} items in this order',
      few: 'You have {count} items in this order',
      many: 'You have {count} items in this order',
      other: 'You have {count} items in this order',
    },
  },
  ar: {
    title: 'ملخص الدفع',
    back: 'رجوع',
    amountDue: 'المبلغ المستحق',
    dueDate: 'تاريخ الاستحقاق',
    hijri: 'هجري',
    gregorian: 'ميلادي',
    phoneLabel: 'رقم الجوال لإرسال الإيصال برسالة نصية',
    phoneHint: 'رقم جوال إماراتي، مثال 050 123 4567',
    phoneError: 'أدخل رقم جوال إماراتي صحيحاً (050 أو 052 أو 054 أو 055 أو 056 أو 058).',
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanHint: 'آيبان إماراتي من 23 خانة يبدأ بـ AE',
    ibanError: 'أدخل رقم آيبان إماراتياً صحيحاً.',
    secure: 'دفع آمن',
    pay: 'ادفع الآن',
    items: {
      zero: 'لا توجد عناصر في طلبك',
      one: 'لديك عنصر واحد في هذا الطلب',
      two: 'لديك عنصران في هذا الطلب',
      few: 'لديك {count} عناصر في هذا الطلب',
      many: 'لديك {count} عنصراً في هذا الطلب',
      other: 'لديك {count} عنصر في هذا الطلب',
    },
  },
} as const;

/* ---------- validation ---------- */

const UAE_MOBILE = /^5[024568]\d{7}$/;

/** Accepts 05x…, 5x…, +9715x…, 009715x…, with spaces or dashes. */
export function normalizeUaeMobile(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '');
  return digits.replace(/^(\+971|00971|971)/, '').replace(/^0/, '');
}

export function isValidUaeMobile(raw: string): boolean {
  return UAE_MOBILE.test(normalizeUaeMobile(raw));
}

/** UAE IBAN: AE + 2 check digits + 3 bank digits + 16 account digits, mod 97 = 1. */
export function isValidUaeIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

const formatIban = (raw: string) =>
  raw
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 23)
    .replace(/(.{4})/g, '$1 ')
    .trim();

/* ---------- formatting (Western digits in both locales, common in UAE fintech) ---------- */

function formatAmount(amount: number, locale: Locale, currency: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDates(date: Date, locale: Locale) {
  const tag = locale === 'ar' ? 'ar-AE' : 'en-AE';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return {
    gregorian: new Intl.DateTimeFormat(`${tag}-u-ca-gregory-nu-latn`, opts).format(date),
    hijri: new Intl.DateTimeFormat(`${tag}-u-ca-islamic-umalqura-nu-latn`, opts).format(date),
  };
}

/* ---------- small pieces ---------- */

function BackArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 rtl:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

interface FieldProps {
  label: string;
  hint: string;
  error: string | null;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputMode: 'tel' | 'text';
  autoComplete: string;
  placeholder: string;
  prefix?: string;
}

function Field(props: FieldProps) {
  const id = useId();
  const describedBy = `${id}-desc`;
  const invalid = Boolean(props.error);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {props.label}
      </label>
      <div
        dir="ltr"
        className={`flex items-center rounded-xl border bg-white transition-colors focus-within:ring-2 ${
          invalid
            ? 'border-red-500 focus-within:ring-red-200'
            : 'border-slate-300 focus-within:border-emerald-600 focus-within:ring-emerald-100'
        }`}
      >
        {props.prefix && (
          <span className="select-none ps-4 text-base text-slate-500">{props.prefix}</span>
        )}
        <input
          id={id}
          dir="ltr"
          type="text"
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          className="min-h-12 w-full bg-transparent px-4 py-3 text-start font-mono text-base tabular-nums tracking-wide text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
      <p
        id={describedBy}
        role={invalid ? 'alert' : undefined}
        className={`text-sm ${invalid ? 'text-red-600' : 'text-slate-500'}`}
      >
        {props.error ?? props.hint}
      </p>
    </div>
  );
}

/* ---------- component ---------- */

export default function PaymentSummary({
  locale,
  dueDate,
  itemCount,
  amountDue = DEFAULT_AMOUNT,
  currency = 'AED',
  onBack,
  onPay,
}: PaymentSummaryProps) {
  const t = STRINGS[locale];
  const isAr = locale === 'ar';

  const [phone, setPhone] = useState('');
  const [iban, setIban] = useState('');
  const [touched, setTouched] = useState({ phone: false, iban: false });

  const phoneError = touched.phone && !isValidUaeMobile(phone) ? t.phoneError : null;
  const ibanError = touched.iban && !isValidUaeIban(iban) ? t.ibanError : null;

  const amountText = useMemo(
    () => formatAmount(amountDue, locale, currency),
    [amountDue, locale, currency],
  );
  const dates = useMemo(() => formatDates(dueDate, locale), [dueDate, locale]);

  const itemsLine = useMemo(() => {
    const category = new Intl.PluralRules(isAr ? 'ar' : 'en').select(itemCount);
    return t.items[category].replace('{count}', new Intl.NumberFormat('en').format(itemCount));
  }, [itemCount, isAr, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ phone: true, iban: true });
    if (!isValidUaeMobile(phone) || !isValidUaeIban(iban)) return;
    onPay?.({
      phone: `+971${normalizeUaeMobile(phone)}`,
      iban: iban.replace(/\s/g, ''),
    });
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      lang={locale}
      className={`min-h-screen bg-slate-50 text-slate-900 antialiased ${
        isAr ? "font-['IBM_Plex_Sans_Arabic',sans-serif]" : "font-['Inter',sans-serif]"
      }`}
    >
      <form onSubmit={handleSubmit} noValidate className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="flex items-center gap-2 px-2 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t.back}
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <BackArrow />
          </button>
          <h1 className="text-lg font-semibold">{t.title}</h1>
        </header>

        <main className="flex-1 space-y-6 px-4 pb-6">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{t.amountDue}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{amountText}</p>

            <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-slate-500">{t.dueDate}</dt>
                <dd className="font-medium tabular-nums">{dates.gregorian}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-slate-500">{t.hijri}</dt>
                <dd className="font-medium tabular-nums">{dates.hijri}</dd>
              </div>
            </dl>

            <p className="mt-5 text-sm text-slate-600">{itemsLine}</p>
          </section>

          <section className="space-y-5">
            <Field
              label={t.phoneLabel}
              hint={t.phoneHint}
              error={phoneError}
              value={phone}
              onChange={setPhone}
              onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="50 123 4567"
              prefix="+971"
            />
            <Field
              label={t.ibanLabel}
              hint={t.ibanHint}
              error={ibanError}
              value={iban}
              onChange={(v) => setIban(formatIban(v))}
              onBlur={() => setTouched((s) => ({ ...s, iban: true }))}
              inputMode="text"
              autoComplete="off"
              placeholder="AE07 0331 2345 6789 0123 456"
            />
          </section>
        </main>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-slate-50/95 px-4 pb-6 pt-3 backdrop-blur">
          <p
            className={`mb-2 text-center text-xs font-semibold text-slate-500 ${
              isAr ? '' : 'uppercase tracking-widest'
            }`}
          >
            {isAr ? t.secure : 'SECURE CHECKOUT'}
          </p>
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:bg-emerald-900"
          >
            {t.pay}
          </button>
        </footer>
      </form>
    </div>
  );
}
