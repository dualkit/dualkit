# @dualkit/format

Gulf formats for bilingual products. Beta.

```sh
npm i @dualkit/format
```

No dependencies. It runs in any modern browser, in Node 18 and later, and at the edge.

## Money

```ts
formatMoney(1234.5, { currency: 'AED' })                                    // AED 1,234.50
formatMoney(1234.5, { currency: 'SAR', locale: 'ar' })                      // 1,234.50 ر.س
formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' })    // ١٬٢٣٤٫٥٠ د.إ
```

The output is the same in every browser, because it never depends on a runtime's Arabic locale data. A negative Arabic amount is wrapped in a bidi isolate, so the minus stays on the number.

## Digits

```ts
toArabicDigits('1,234.50')   // ١٬٢٣٤٫٥٠
toWesternDigits('٠٥٠١٢٣٤٥٦٧') // 0501234567  (Persian digits too)
```

Run `toWesternDigits` on any number a person types before you store it.

## Hijri dates

```ts
formatHijri(new Date('2026-02-18'), { timeZone: 'Asia/Riyadh' })                 // 1 Ramadan 1447 AH
formatHijri(date, { locale: 'ar', numerals: 'arab', timeZone: 'Asia/Dubai' })    // ١ رمضان ١٤٤٧ هـ
toHijri(date, { timeZone: 'Asia/Dubai' })                                        // { year: 1447, month: 9, day: 1 }
```

Dates use the Umm al-Qura calendar. Always pass a `timeZone`, because the Hijri day follows the person's local day. If a runtime has no Umm al-Qura calendar, the functions throw instead of quietly returning a Gregorian date.

## UAE phone numbers

```ts
parseUaePhone('+971 50 123 4567')  // { ok: true, value: { e164: '+971501234567', type: 'mobile' } }
formatUaePhone('0501234567')                              // 050 123 4567
formatUaePhone('0501234567', { style: 'international' })  // +971 50 123 4567
isValidUaePhone('0511234567')                             // false, no network uses 051
```

It reads 050…, +971…, 00971…, 971…, spaces, dashes, brackets and Arabic digits. It covers mobiles (50, 52, 54, 55, 56, 58) and landlines (2, 3, 4, 6, 7, 9).

## Emirates ID

```ts
parseEmiratesId('784-1990-1234567-6')  // { ok: true, value: { digits, formatted, year: 1990 } }
isValidEmiratesId('784199012345675')   // false, the check digit is wrong
```

## IBAN

```ts
parseIban('AE07 0331 2345 6789 0123 456')  // { ok: true, value: { country: 'AE', bankCode: '033', … } }
parseIban(input, { country: 'SA' })          // accept Saudi IBANs only
formatIban('SA0380000000608010167519')      // SA03 8000 0000 6080 1016 7519
```

It supports the UAE, Saudi Arabia, Bahrain, Kuwait and Qatar.

## Errors

The `parse*` functions never throw. They return `{ ok: true, value }` or `{ ok: false, error: { code, message } }`. The `code` is stable, so you can map it to your own Arabic and English copy. The `message` is English and is there for logs.

## Status

This is v0.1 beta. A native Arabic reviewer has not yet checked the Arabic month names, currency abbreviations or the Arabic layout of the output. Please open an issue if anything reads wrong.

MIT
