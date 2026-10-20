# Cornerstone project 2: formats for six GCC countries (design)

Date: 19 Oct 2026. Project 2 of 6 in the cornerstone programme (see `docs/plans/2026-10-19-cornerstone-gap-map.md`). Research with sources: `docs/research/2026-10-19-gcc-facts.md`.

Status: written overnight by Claude while Sam slept. Every decision below is Claude's call unless marked otherwise. Built on a branch with a PR, not merged until Sam approves this design.

## Intent

`@dualkit/format` says it is a Gulf toolkit, but it reads phones only for the UAE and Saudi Arabia and has no Oman IBAN. Someone building for Doha, Kuwait City, Manama or Muscat gets nothing. This project makes the package cover all six GCC countries for the things it already does, plus the two Gulf facts people get wrong most often: which days are the weekend, and which currency sign to use.

Sam's bar from project 1 carries over: **no mistakes.** A validator that rejects a real person's number is worse than no validator. Only facts marked VERIFIED in the research ship as hard rules.

## Goals

1. Phones: parse, validate and format numbers for Qatar, Kuwait, Bahrain and Oman. The API matches the existing UAE and Saudi functions. One dispatcher reads an international number from any of the six countries.
2. IBAN: add Oman (OM, 23 characters).
3. Saudi VAT number: validate and format.
4. Weekends: a static table that answers, for each country (and Sharjah's government week), which days are the weekend and which day the work week starts.
5. Currency signs: one function that returns the Unicode sign for SAR, AED and OMR, and null for QAR, KWD and BHD.
6. Hijri: `timeZone` becomes required, so the day can't silently follow the server's zone.
7. Docs and release surfaces say exactly what is covered.

## Non-goals

- National IDs beyond the Emirates ID. The Saudi, Kuwait, Bahrain, Qatar and Oman ID checksums have no official source. They come back when a source is found. The Emirates ID Luhn already ships and stays as it is.
- VAT numbers for the UAE, Bahrain and Oman, and VAT rates. Their formats come only from e-invoicing specs or tax guides (SECONDARY).
- Addresses, e-invoicing QR, holidays and Ramadan hours. These are later projects.
- An SVG fallback for the currency signs. That is project 5 (design system).
- Publishing to npm. That happens after merge, with Sam.

## Anti-goals

- Rejecting a real number. Where the regulator's table is finer than the prefix (Bahrain 3x and 6x), accept the whole block.
- Guessing a number's type. If the first digits can't say mobile or landline, the type is `'unknown'`, not a guess.
- Shipping CLDR's week data as work-week truth. CLDR says Kuwait, Bahrain, Qatar and Oman start the week on Saturday. Their work week starts on Sunday.

## Decisions

### Phones

Each new country gets the same three functions and four types as `phone.ts`, in its own file:

| Country | File | Functions | Error for another country |
|---|---|---|---|
| Qatar +974 | `qatar-phone.ts` | `parseQatarPhone`, `isValidQatarPhone`, `formatQatarPhone` | `not_qatar` |
| Kuwait +965 | `kuwait-phone.ts` | `parseKuwaitPhone`, `isValidKuwaitPhone`, `formatKuwaitPhone` | `not_kuwait` |
| Bahrain +973 | `bahrain-phone.ts` | `parseBahrainPhone`, `isValidBahrainPhone`, `formatBahrainPhone` | `not_bahrain` |
| Oman +968 | `oman-phone.ts` | `parseOmanPhone`, `isValidOmanPhone`, `formatOmanPhone` | `not_oman` |

All four use an 8-digit national number and no trunk 0, so `nationalNumber` must not strip a leading 0 for them. A leading 0 is an `unknown_prefix` error. Error codes: `empty`, `invalid_characters`, `not_<country>`, `invalid_length`, `unknown_prefix`, the same as UAE.

Prefixes (ITU national numbering plans, VERIFIED):

- Qatar: mobile 3, 5, 6, 7; landline 4.
- Kuwait: mobile 41, 5, 6, 9; landline 2.
- Bahrain: mobile 3 (the whole block); landline 13, 16, 17; `unknown` for 6 and 77, because the ITU table mixes mobile and fixed in them.
- Oman: mobile 71, 72, 74 to 79, 90 (901 to 909 only), 91 to 99; landline 21 to 26.

Display: `XXXX XXXX` for all, except Oman landlines (`XX XXXXXX`). The international style adds `+974 ` and the others. The style names are the same: `national`, `international`, `e164`.

`type` is `'mobile' | 'landline'` for Qatar, Kuwait and Oman, and `'mobile' | 'landline' | 'unknown'` for Bahrain.

The dispatcher is `parseGulfPhone(input)`. It reads only international input (`+` or `00`), picks the country from the code, and returns `{ country: 'AE' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM', e164, type }`. Without a country code it returns `needs_country_code`, because an 8-digit number is valid in four countries. It also exports `isValidGulfPhone`. Error codes: `empty`, `invalid_characters`, `needs_country_code`, `not_gulf`, plus the country's own error.

UAE and Saudi prefix sets stay unchanged. The research rechecked both against TDRA and CST, and they are right.

### IBAN

Add `OM: { length: 23, bankCode: 3 }`, and `'OM'` to `GulfIbanCountry`. No other IBAN change.

### Saudi VAT number

`saudi-vat.ts`: `parseSaudiVatNumber`, `isValidSaudiVatNumber`, `formatSaudiVatNumber`. The rule is 15 digits, first and last digit 3 (ZATCA BR-KSA-40). Spaces and Arabic-Indic digits are accepted on input. Format is the 15 digits with no separators, because that is how ZATCA prints it. Errors: `empty`, `invalid_characters`, `invalid_length`, `invalid_prefix` (not 3 first), `invalid_suffix` (not 3 last).

### Weekends

`week.ts` exports `gulfWeek(region)`. Region is `'AE' | 'AE-SH' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'`. It returns `{ weekend: readonly Weekday[], firstWorkday: Weekday }`, where `Weekday` is ISO 1 (Monday) to 7 (Sunday), the same numbering `Intl.Locale.getWeekInfo` uses.

| Region | Weekend | First workday |
|---|---|---|
| AE (federal) | 6, 7 | 1 |
| AE-SH (Sharjah government) | 5, 6, 7 | 1 |
| SA, QA, KW, BH, OM | 5, 6 | 7 |

It also exports `isGulfWeekend(date, region, { timeZone })`. `timeZone` is required for the same reason as Hijri. The JSDoc says the UAE's Friday is a half day for government, and that private employers set their own week.

### Currency signs

`currencySign(currency)` returns `'⃁'` for SAR, `'⃃'` for AED, `'⃄'` for OMR, and `null` for QAR, KWD and BHD. JSDoc: most fonts don't draw these yet, so show the sign only with a font you ship that has it; otherwise use the code or the Arabic abbreviation. `formatMoney` is unchanged.

### Hijri timeZone required (breaking)

`HijriOptions.timeZone` becomes required, and so `toHijri(date, { timeZone })` and `formatHijri(date, { timeZone, ... })` need it. The package is still beta (0.1.0-beta.1), so this is allowed. Every call site in the repo is updated (starter DateDisplay, site Stage and clock, docs page, the registry JSON, skill examples). An invalid zone throws the runtime's RangeError, as before.

### Version and release

- `@dualkit/format` goes to `0.2.0-beta.0`.
- The format README: coverage table by country, new examples, and the Hijri change.
- The gulf-formats skill: the coverage line is updated to the new truth (all six countries' phones and IBANs, the Saudi VAT number, `gulfWeek`, `currencySign`). The 900-word limit still applies. Cursor rules are rebuilt.
- dualkit.dev: a `/updates` entry, the docs page format section, and the roadmap ticks if they name these items.
- The repo README and org profile change only if they quote the coverage.
- One PR, CI green, **not merged** until Sam approves this design. Publishing to npm is a separate step after merge.

### Tests

TDD, the same style as `phone.test.ts`. Each country gets:
- a test for every prefix it accepts, using the synthetic examples from the research
- a reject test for one prefix next to each accepted block, for a trunk 0, and for a wrong length
- Arabic-Indic input
- `00` input

The dispatcher gets one case per country plus `needs_country_code`. Week tests cover every region, plus a date that crosses midnight between UTC and Asia/Dubai. Coverage stays at or above the package's current level.

## Left to the builder

- Whether the four countries share a small helper (a prefix table plus a classify function) or keep one file each like `phone.ts`. Prefer a shared helper if it keeps each file under about 60 lines and the existing UAE and Saudi files untouched.
- Exact message strings, in the existing voice.
