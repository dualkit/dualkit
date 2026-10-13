import {
  formatHijri, formatMoney, formatUaePhone, parseEmiratesId, parseIban, parseUaePhone, toWesternDigits,
} from '@dualkit/format'

export type TabId = 'money' | 'hijri' | 'phone' | 'iban' | 'emiratesId'
export type Row = { label: string; value: string; arabic?: boolean }
export type TabResult = { rows: Row[]; valid?: boolean } | { error: string }
export type Tab = { id: TabId; name: string; label: string; sample: string; arabicSample: string }

export const FORMAT_TABS: readonly Tab[] = [
  { id: 'money', name: 'Money', label: 'Amount', sample: '1234.5', arabicSample: '١٢٣٤٫٥' },
  { id: 'hijri', name: 'Hijri', label: 'Date (YYYY-MM-DD)', sample: '2026-02-18', arabicSample: '٢٠٢٦-٠٢-١٨' },
  { id: 'phone', name: 'Phone', label: 'UAE phone number', sample: '050 123 4567', arabicSample: '٠٥٠ ١٢٣ ٤٥٦٧' },
  { id: 'iban', name: 'IBAN', label: 'Gulf IBAN', sample: 'AE07 0331 2345 6789 0123 456', arabicSample: 'AE٠٧ ٠٣٣١ ٢٣٤٥ ٦٧٨٩ ٠١٢٣ ٤٥٦' },
  { id: 'emiratesId', name: 'Emirates ID', label: 'Emirates ID', sample: '784-1990-1234567-6', arabicSample: '٧٨٤-١٩٩٠-١٢٣٤٥٦٧-٦' },
]

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DEMO_ZONE = 'Asia/Riyadh'

function money(input: string): TabResult {
  const n = Number(toWesternDigits(input).replace(/,/g, '').trim())
  if (!input.trim() || !Number.isFinite(n)) return { error: 'Enter a number, in Western or Arabic digits.' }
  return { rows: [
    { label: 'English', value: formatMoney(n, { currency: 'AED' }) },
    { label: 'Arabic', value: formatMoney(n, { currency: 'AED', locale: 'ar', numerals: 'arab' }), arabic: true },
    { label: 'Riyal', value: formatMoney(n, { currency: 'SAR' }) },
    { label: 'ريال', value: formatMoney(n, { currency: 'SAR', locale: 'ar' }), arabic: true },
  ] }
}

function hijri(input: string): TabResult {
  const iso = toWesternDigits(input).trim()
  const date = new Date(`${iso}T12:00:00Z`)
  if (!DATE.test(iso) || Number.isNaN(date.getTime())) return { error: 'Enter a date like 2026-02-18.' }
  const zone = { timeZone: DEMO_ZONE }
  return { rows: [
    { label: 'English', value: formatHijri(date, zone) },
    { label: 'Arabic', value: formatHijri(date, { ...zone, locale: 'ar' }), arabic: true },
    { label: 'Arabic digits', value: formatHijri(date, { ...zone, locale: 'ar', numerals: 'arab' }), arabic: true },
  ] }
}

function phone(input: string): TabResult {
  const parsed = parseUaePhone(input)
  if (!parsed.ok) return { error: parsed.error.message }
  return { valid: true, rows: [
    { label: 'National', value: formatUaePhone(input) ?? '' },
    { label: 'International', value: formatUaePhone(input, { style: 'international' }) ?? '' },
    { label: 'E.164', value: parsed.value.e164 },
    { label: 'Type', value: parsed.value.type },
  ] }
}

function iban(input: string): TabResult {
  const parsed = parseIban(input)
  if (!parsed.ok) return { error: parsed.error.message }
  return { valid: true, rows: [
    { label: 'Formatted', value: parsed.value.formatted },
    { label: 'Country', value: parsed.value.country },
    { label: 'Bank code', value: parsed.value.bankCode },
  ] }
}

function emiratesId(input: string): TabResult {
  const parsed = parseEmiratesId(input)
  if (!parsed.ok) return { error: parsed.error.message }
  return { valid: true, rows: [
    { label: 'Formatted', value: parsed.value.formatted },
    { label: 'Masked', value: `784-****-*******-${parsed.value.digits.slice(-1)}` },
    { label: 'Year', value: String(parsed.value.year) },
  ] }
}

const RUNNERS: Record<TabId, (input: string) => TabResult> = { money, hijri, phone, iban, emiratesId }

/** Runs the real @dualkit/format on what the visitor typed. */
export const runTab = (id: TabId, input: string): TabResult => RUNNERS[id](input)
