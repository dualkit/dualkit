# @dualkit/format

Gulf formats for bilingual products. Beta.

```sh
npm i @dualkit/format
```

No dependencies. It runs in any modern browser, in Node 18 and later, and at the edge.

## Coverage

| Country | Phone | IBAN | Other |
| --- | --- | --- | --- |
| UAE | Yes | Yes | Emirates ID, weekend, Sharjah weekend |
| Saudi Arabia | Yes | Yes | VAT number, weekend |
| Qatar | Yes | Yes | Weekend |
| Kuwait | Yes | Yes | Weekend |
| Bahrain | Yes | Yes | Weekend |
| Oman | Yes | Yes | Weekend |

Every country also has its currency in `formatMoney`. `parseGulfPhone` reads a number from any of the six.

## Money

```ts
formatMoney(1234.5, { currency: 'AED' })                                    // AED 1,234.50
formatMoney(1234.5, { currency: 'SAR', locale: 'ar' })                      // 1,234.50 ر.س
formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' })    // ١٬٢٣٤٫٥٠ د.إ
formatMoney(1.5, { currency: 'KWD' })                                       // KWD 1.500
```

It covers AED, SAR, QAR, KWD, BHD and OMR. The Kuwaiti and Bahraini dinars and the Omani rial show three decimals by default, because they split into 1,000 fils or baisa. Pass `fractionDigits` to override.

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

Dates use the Umm al-Qura calendar. `timeZone` is now required for `toHijri` and `formatHijri`, because the Hijri day follows the person's local day. In 0.1 it was optional. A call without it throws a `RangeError`, so add it to every call. If a runtime has no Umm al-Qura calendar, the functions throw instead of quietly returning a Gregorian date.

## UAE phone numbers

```ts
parseUaePhone('+971 50 123 4567')  // { ok: true, value: { e164: '+971501234567', type: 'mobile' } }
formatUaePhone('0501234567')                              // 050 123 4567
formatUaePhone('0501234567', { style: 'international' })  // +971 50 123 4567
isValidUaePhone('0511234567')                             // false, no network uses 051
```

It reads 050…, +971…, 00971…, 971…, spaces, dashes, brackets and Arabic digits. It covers mobiles (50, 52, 54, 55, 56, 58) and landlines (2, 3, 4, 6, 7, 9).

## Saudi phone numbers

```ts
parseSaudiPhone('+966 55 123 4567')  // { ok: true, value: { e164: '+966551234567', type: 'mobile' } }
formatSaudiPhone('0551234567')                              // 055 123 4567
formatSaudiPhone('0112345678', { style: 'international' })  // +966 11 234 5678
isValidSaudiPhone('0521234567')                             // false, 052 is not assigned
```

It reads the same shapes as the UAE parser. It covers mobiles (50, 51, 53 to 59) and landlines (11, 12, 13, 14, 16, 17).

## Phone numbers for Qatar, Kuwait, Bahrain and Oman

```ts
parseQatarPhone('+974 3312 3456')   // { ok: true, value: { e164: '+97433123456', type: 'mobile' } }
parseKuwaitPhone('+965 5012 3456')  // { ok: true, value: { e164: '+96550123456', type: 'mobile' } }
parseBahrainPhone('3912 3456')      // { ok: true, value: { e164: '+97339123456', type: 'mobile' } }
parseOmanPhone('9212 3456')         // { ok: true, value: { e164: '+96892123456', type: 'mobile' } }
formatOmanPhone('92123456', { style: 'international' })  // +968 9212 3456
isValidKuwaitPhone('50123456')      // true
```

Each country has `parse`, `format` and `isValid` functions, named like the UAE and Saudi ones. Bahrain numbers in the 6 and 77 blocks return type `unknown`, because those blocks mix mobile and landline.

## Any Gulf phone number

```ts
parseGulfPhone('+974 3312 3456')  // { ok: true, value: { country: 'QA', e164: '+97433123456', type: 'mobile' } }
parseGulfPhone('3312 3456')       // { ok: false, error: { code: 'needs_country_code', … } }
isValidGulfPhone('00966551234567') // true
```

Four countries use eight-digit numbers, so a bare number can belong to any of them. `parseGulfPhone` needs a `+` or `00` and the country code.

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

It supports all six countries: AE, SA, QA, KW, BH and OM.

## Saudi VAT number

```ts
parseSaudiVatNumber('310 1223 9350 0003')  // { ok: true, value: '310122393500003' }
isValidSaudiVatNumber('210122393500003')   // false, it must start with 3
formatSaudiVatNumber('310 1223 9350 0003') // 310122393500003
```

It checks for 15 digits that start and end with 3, the rule ZATCA uses. It does not check that the number is registered.

## Weekends and currency signs

```ts
gulfWeek('AE')     // { weekend: [6, 7], firstWorkday: 1 }
gulfWeek('SA')     // { weekend: [5, 6], firstWorkday: 7 }
isGulfWeekend(new Date('2026-10-23T12:00:00Z'), 'SA', { timeZone: 'Asia/Riyadh' })  // true
currencySign('SAR')  // the U+20C1 sign
currencySign('QAR')  // null, there is no sign
```

Days are ISO weekdays, so 1 is Monday and 7 is Sunday. The UAE weekend is Saturday and Sunday. `AE-SH` is Sharjah government, Friday to Sunday. The other countries take Friday and Saturday and start the week on Sunday. The UAE weeks follow u.ae. The Friday and Saturday weekend for the other five is the usual working week and matches Unicode CLDR, but we have not checked it against a government page. Private employers set their own. `timeZone` is required.

`currencySign` returns a sign for SAR, AED and OMR and `null` for the rest. Most fonts do not draw these signs yet, so fall back to the code.

## Errors

The `parse*` functions never throw. They return `{ ok: true, value }` or `{ ok: false, error: { code, message } }`. The `code` is stable, so you can map it to your own Arabic and English copy. The `message` is English and is there for logs.

## Status

This is a beta. A native Arabic reviewer has not yet checked the Arabic month names, currency abbreviations or the Arabic layout of the output. Please open an issue if anything reads wrong.

MIT
