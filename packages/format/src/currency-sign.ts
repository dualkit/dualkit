import type { Currency } from './money'

/** U+20C1, U+20C3 and U+20C4 are in Unicode 17 and 18. QAR, KWD and BHD have no sign. */
const SIGNS: Record<Currency, string | null> = {
  SAR: '⃁',
  AED: '⃃',
  OMR: '⃄',
  QAR: null,
  KWD: null,
  BHD: null,
}

/** The Unicode sign for SAR, AED or OMR, and null for the rest. Most fonts lack the glyphs yet, so fall back to the code. */
export const currencySign = (currency: Currency): string | null => SIGNS[currency]
