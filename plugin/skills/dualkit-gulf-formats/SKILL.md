---
name: dualkit-gulf-formats
description: Use when showing or accepting money in AED, SAR, QAR, KWD, BHD or OMR, Arabic-Indic or Western digits, Hijri or Umm al-Qura dates, UAE or Saudi phone numbers, Emirates ID, IBANs, or weekends and working days, in a product for the UAE, Saudi Arabia or the wider Gulf
---

# Gulf formats

## Overview

Make every format decision explicit. Intl defaults change by locale and by browser. For example, `ar-SA` gives Arabic-Indic digits, `ar-AE` gives Western digits, and older browsers give Arabic-Indic for plain `ar`. Leave that to chance and one screen ends up mixing digit systems and showing dates a day out.

`@dualkit/format` implements every rule below, with tests.

Coverage today: `@dualkit/format` parses UAE and Saudi phones and Emirates ID, and checks IBANs for AE, SA, BH, KW and QA. Other Gulf phones, national IDs and Omani IBANs are coming.

```ts
import { formatMoney, formatHijri, parseUaePhone, parseSaudiPhone, parseEmiratesId, parseIban, toWesternDigits } from '@dualkit/format'
```

## Digits

- Pick one digit system per product (a setting, not a guess from the locale) and apply it everywhere: amounts, counts, dates, page numbers. Western digits are standard in UAE apps. Saudi government and formal content often uses Arabic-Indic.
- With raw Intl, always pin it: `ar-AE-u-nu-latn` or `ar-SA-u-nu-arab`.
- **Normalise every typed number before you validate or store it.** Arabic keyboards type `٠٥٠١٢٣٤٥٦٧`, and some Gulf keyboards type Persian digits `۰۵۰`. Use `toWesternDigits(value)`.
- Store Western digits. Convert only for display.

## Money

```ts
formatMoney(1234.5, { currency: 'AED' })                                  // AED 1,234.50
formatMoney(1234.5, { currency: 'SAR', locale: 'ar', numerals: 'arab' })  // ١٬٢٣٤٫٥٠ ر.س
formatMoney(1.5, { currency: 'KWD', locale: 'ar' })                       // 1.500 د.ك
```

- AED, SAR and QAR take two decimals (fils, halalas, dirhams). KWD, BHD and OMR take **three** (fils and baisa). Never hardcode two decimals for every Gulf currency.
- Round on purpose, never by accident.
- In body text, use the code or the Arabic abbreviation: AED / د.إ, SAR / ر.س, QAR / ر.ق, KWD / د.ك, BHD / د.ب, OMR / ر.ع.
- Saudi Arabia, the UAE and Oman now have currency signs. The Saudi riyal sign is U+20C1 (Unicode 17). The UAE dirham sign is U+20C3 and the Omani rial sign is U+20C4 (Unicode 18). Most fonts show an empty box for them today. Show a sign only with a font you ship that draws it, and include its code point in that font's `unicode-range`.
- Keep amounts as integers in minor units in storage and APIs, never floats.

## Dates

```ts
formatHijri(dueDate, { timeZone: 'Asia/Dubai' })                                   // 1 Ramadan 1447 AH
formatHijri(dueDate, { locale: 'ar', numerals: 'arab', timeZone: 'Asia/Riyadh' })  // ١ رمضان ١٤٤٧ هـ
```

- **Always pass `timeZone`** (`Asia/Dubai` is UTC+4, `Asia/Riyadh` is UTC+3), for Gregorian dates too. If you don't, the server and the browser can render different days, and you get hydration mismatches.
- Use `islamic-umalqura`, not plain `islamic`. Umm al-Qura is Saudi Arabia's official calendar.
- Ramadan and Eid begin on a moon sighting and can differ from any computed calendar by a day. Never promise those dates from a calculation. Label them as expected dates.
- Weekends: the UAE federal government and most private companies take Saturday and Sunday (since 2022), with a short Friday for federal staff. Sharjah government takes Friday to Sunday. Saudi Arabia is Friday and Saturday. Make the weekend configurable per market and per customer.

## Phone, Emirates ID, IBAN

```ts
parseUaePhone('٠٥٠ ١٢٣ ٤٥٦٧')  // { ok: true, value: { e164: '+971501234567', type: 'mobile' } }
parseSaudiPhone('055 123 4567')  // { ok: true, value: { e164: '+966551234567', type: 'mobile' } }
parseEmiratesId(value)          // checks the 784 prefix and the Luhn check digit
parseIban(value, { country: 'AE' })  // checks the length per country and mod 97
```

- Accept every common way of writing a number: `050…`, `+971 50…`, `00971…`, `+971 (0) 50…`, with spaces and dashes. Store E.164.
- Use `inputMode="tel"` for phones, `inputMode="numeric"` for Emirates ID, and `dir="ltr"` on all three fields (see dualkit-rtl-layout).
- Treat the Emirates ID as sensitive personal data. Mask it in the UI (`784-****-*******-6`), and never log it or put it in analytics.
- Show IBANs in groups of four. Accept them pasted with spaces, in lower case, or with Arabic digits.

## Common mistakes

- `new Intl.NumberFormat('ar-SA')` for a count next to a Western-digit phone number on the same screen.
- A date formatted with no `timeZone`.
- Validating a phone with a regex before normalising its digits.
- Hard-coding a Friday weekend for the UAE.
