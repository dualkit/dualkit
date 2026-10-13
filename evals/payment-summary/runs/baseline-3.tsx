import React, { useId, useMemo, useState } from 'react';

export type Locale = 'en' | 'ar';

export interface PaymentSummaryProps {
  locale: Locale;
  dueDate: Date;
  count: number;
  amount?: number;
  onBack?: () => void;
  onPay?: (payload: { phone: string; iban: string }) => void;
}

const AMOUNT_DUE_DEFAULT = 1234.5;
const CURRENCY = 'AED';

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');";

const FONT_STACK: Record<Locale, string> = {
  en: "'Inter', system-ui, sans-serif",
  ar: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui, sans-serif",
};

const STRINGS = {
  en: {
    back: 'Go back',
    title: 'Payment summary',
    amountDue: 'Amount due',
    dueDate: 'Due date',
    hijri: 'Hijri',
    items: (n: string) => `You have ${n} items in this order`,
    itemsOne: () => 'You have 1 item in this order',
    phoneLabel: 'Mobile number for SMS receipt',
    phoneHint: 'UAE mobile, e.g. 050 123 4567',
    phoneError: 'Enter a valid UAE mobile number, for example 050 123 4567.',
    ibanLabel: 'IBAN for refunds',
    ibanHint: 'UAE IBAN, 23 characters, starts with AE',
    ibanError: 'Enter a valid UAE IBAN, for example AE07 0331 2345 6789 0123 456.',
    secure: 'SECURE CHECKOUT',
    pay: 'Pay now',
  },
  ar: {
    back: 'رجوع',
    title: 'ملخص الدفع',
    amountDue: 'المبلغ المستحق',
    dueDate: 'تاريخ الاستحقاق',
    hijri: 'هجري',
    items: (n: string) => `لديك ${n} عناصر في هذا الطلب`,
    itemsOne: () => 'لديك عنصر واحد في هذا الطلب',
    itemsTwo: () => 'لديك عنصران في هذا الطلب',
    itemsMany: (n: string) => `لديك ${n} عنصرًا في هذا الطلب`,
    phoneLabel: 'رقم الجوال لإرسال الإيصال برسالة نصية',
    phoneHint: 'رقم جوال إماراتي، مثل 050 123 4567',
    phoneError: 'أدخل رقم جوال إماراتي صحيحًا، مثل 050 123 4567.',
    ibanLabel: 'رقم الآيبان لاسترداد المبالغ',
    ibanHint: 'آيبان إماراتي من 23 خانة يبدأ بـ AE',
    ibanError: 'أدخل رقم آيبان إماراتي صحيحًا، مثل AE07 0331 2345 6789 0123 456.',
    secure: 'دفع آمن',
    pay: 'ادفع الآن',
  },
} as const;

/* ---------- validation ---------- */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Converts Arabic-Indic and Persian digits to ASCII. */
function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_INDIC.indexOf(ch);
    return String(a >= 0 ? a : EXT_ARABIC_INDIC.indexOf(ch));
  });
}

/** UAE mobile prefixes: 50, 52, 54, 55, 56, 58 followed by 7 digits. */
export function isValidUaeMobile(raw: string): boolean {
  const cleaned = normalizeDigits(raw).replace(/[\s\-().]/g, '');
  return /^(?:\+971|00971|971|0)?5[024568]\d{7}$/.test(cleaned);
}

/** UAE IBAN: AE + 2 check digits + 3 bank code + 16 account digits, mod-97 verified. */
export function isValidUaeIban(raw: string): boolean {
  const iban = normalizeDigits(raw).replace(/\s/g, '').toUpperCase();
  if (!/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : ch;
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/* ---------- formatting ---------- */

function formatIbanInput(value: string): string {
  const compact = normalizeDigits(value)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 23);
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

function useItemsLine(locale: Locale, count: number): string {
  return useMemo(() => {
    const t = STRINGS[locale];
    const n = new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE').format(count);
    if (locale === 'en') return count === 1 ? t.itemsOne() : t.items(n);
    const category = new Intl.PluralRules('ar').select(count);
    const ar = STRINGS.ar;
    switch (category) {
      case 'one':
        return ar.itemsOne();
      case 'two':
        return ar.itemsTwo();
      case 'many':
        return ar.itemsMany(n);
      default:
        return ar.items(n);
    }
  }, [locale, count]);
}

/* ---------- parts ---------- */

function BackArrow({ rtl }: { rtl: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={rtl ? 'rotate-180' : undefined}
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
  onChange: (v: string) => void;
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
  value,
  onChange,
  onBlur,
  inputMode,
  autoComplete,
  placeholder,
  prefix,
}: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : `${id}-hint`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <div
        className={`flex items-center rounded-xl border bg-white px-4 ring-offset-0 focus-within:ring-2 ${
          error
            ? 'border-red-600 focus-within:ring-red-200'
            : 'border-slate-300 focus-within:border-emerald-700 focus-within:ring-emerald-100'
        }`}
      >
        {prefix ? (
          <span dir="ltr" className="me-3 text-slate-500" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        {/* Numbers and IBANs are always LTR, aligned to the start edge */}
        <input
          id={id}
          dir="ltr"
          type="text"
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 [text-align:start] rtl:[text-align:right]"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
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
  count,
  amount = AMOUNT_DUE_DEFAULT,
  onBack,
  onPay,
}: PaymentSummaryProps) {
  const t = STRINGS[locale];
  const rtl = locale === 'ar';
  const intlLocale = rtl ? 'ar-AE' : 'en-AE';

  const [phone, setPhone] = useState('');
  const [iban, setIban] = useState('');
  const [touched, setTouched] = useState({ phone: false, iban: false });

  const phoneValid = isValidUaeMobile(phone);
  const ibanValid = isValidUaeIban(iban);
  const phoneError = touched.phone && !phoneValid ? t.phoneError : null;
  const ibanError = touched.iban && !ibanValid ? t.ibanError : null;

  const formattedAmount = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
    [intlLocale, amount],
  );

  const { gregorian, hijri } = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Dubai',
    };
    return {
      gregorian: new Intl.DateTimeFormat(`${intlLocale}-u-ca-gregory`, opts).format(dueDate),
      hijri: new Intl.DateTimeFormat(`${intlLocale}-u-ca-islamic-umalqura`, opts).format(dueDate),
    };
  }, [intlLocale, dueDate]);

  const itemsLine = useItemsLine(locale, count);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ phone: true, iban: true });
    if (!phoneValid || !ibanValid) return;
    onPay?.({
      phone: normalizeDigits(phone).replace(/[\s\-().]/g, ''),
      iban: iban.replace(/\s/g, ''),
    });
  };

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      lang={locale}
      style={{ fontFamily: FONT_STACK[locale] }}
      className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 text-slate-900"
    >
      <style>{FONT_IMPORT}</style>

      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.back}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-800 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <BackArrow rtl={rtl} />
        </button>
        <h1 className="text-lg font-semibold">{t.title}</h1>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-6 px-4 pb-8">
        <section aria-labelledby="amount-label" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p id="amount-label" className="text-sm text-slate-500">
            {t.amountDue}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{formattedAmount}</p>

          <dl className="mt-5 flex flex-col gap-1 border-t border-slate-200 pt-4">
            <dt className="text-sm text-slate-500">{t.dueDate}</dt>
            <dd className="text-base font-medium">
              <time dateTime={dueDate.toISOString()}>{gregorian}</time>
            </dd>
            <dd className="text-sm text-slate-600">
              <span className="text-slate-500">{t.hijri}: </span>
              {hijri}
            </dd>
          </dl>

          <p className="mt-5 text-sm text-slate-700">{itemsLine}</p>
        </section>

        <Field
          label={t.phoneLabel}
          hint={t.phoneHint}
          error={phoneError}
          value={phone}
          onChange={setPhone}
          onBlur={() => setTouched((s) => ({ ...s, phone: true }))}
          inputMode="tel"
          autoComplete="tel"
          placeholder="050 123 4567"
          prefix="+971"
        />

        <Field
          label={t.ibanLabel}
          hint={t.ibanHint}
          error={ibanError}
          value={iban}
          onChange={(v) => setIban(formatIbanInput(v))}
          onBlur={() => setTouched((s) => ({ ...s, iban: true }))}
          inputMode="text"
          autoComplete="off"
          placeholder="AE07 0331 2345 6789 0123 456"
        />

        <div className="mt-auto flex flex-col gap-3">
          {/* Arabic has no case, and letter-spacing breaks its joined letterforms */}
          <p
            className={`text-center text-xs font-medium text-slate-500 ${
              rtl ? '' : 'uppercase tracking-widest'
            }`}
          >
            {t.secure}
          </p>
          <button
            type="submit"
            className="h-14 w-full rounded-xl bg-emerald-800 px-6 text-base font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:bg-emerald-950"
          >
            {t.pay}
          </button>
        </div>
      </form>
    </div>
  );
}
