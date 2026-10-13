import { formatEmiratesId, formatHijri, formatIban, formatMoney, formatUaePhone, toArabicDigits } from '@dualkit/format'

// Real outputs of @dualkit/format, rendered on the server, moving at 40px/s.
const DUE = new Date('2026-02-18T12:00:00Z')
const SPEED = 40
const CHIP_WIDTH_ESTIMATE = 230

export function FormatTicker() {
  const chips: [string, string, boolean][] = [
    ['Money', formatMoney(1234.5, { currency: 'AED' }), false],
    ['Arabic', formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' }), true],
    ['Riyal', formatMoney(99, { currency: 'SAR', locale: 'ar' }), true],
    ['Hijri', formatHijri(DUE, { timeZone: 'Asia/Riyadh' }), false],
    ['هجري', formatHijri(DUE, { locale: 'ar', numerals: 'arab', timeZone: 'Asia/Riyadh' }), true],
    ['Phone', formatUaePhone('0501234567', { style: 'international' }) ?? '', false],
    ['Digits', toArabicDigits('2026'), true],
    ['IBAN', formatIban('SA0380000000608010167519') ?? '', false],
    ['Emirates ID', formatEmiratesId('784199012345676') ?? '', false],
  ]
  const items = chips.map(([k, v, ar]) => (
    <span className="chip" key={k}><span className="k">{k}</span><bdi lang={ar ? 'ar' : undefined}>{v}</bdi></span>
  ))
  return (
    <div className="ticker" aria-hidden="true">
      <div className="track" style={{ ['--dur' as string]: `${(chips.length * CHIP_WIDTH_ESTIMATE) / SPEED}s` }}>{items}{items}</div>
    </div>
  )
}
