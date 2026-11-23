# Gulf national IDs

Date: 2026-11-23. Status: approved approach, design awaiting sign-off.

## Why

Design engineers building Middle East products (onboarding, KYC, account screens) paste `gulf-national-id-input` and expect it to work for every Gulf country. Today it only reads Emirates IDs, so a Saudi, Kuwaiti or Qatari form has no answer from Dualkit. Saudi Arabia is the largest market and the most visible gap. This finishes a gap the components page already shows ("Emirates ID for now").

## Goals

- `@dualkit/format` reads national IDs for the UAE, Saudi Arabia (ID and Iqama), Kuwait, Qatar and Bahrain.
- Every result says how strong its check was: a real checksum, or shape only.
- `gulf-national-id-input` takes a `country` prop and formats, validates and sets its placeholder per country.
- The MCP `validate` tool reads all five.
- Synthetic sample IDs for every country, shared by tests, site demos and the Figma plugin's Fill Gulf samples.

## Non-goals

- Oman. No reliable public source gives the civil number's length. It joins when we find an official one, and the docs say so.
- Saudi National Address and `parseMoney`. Separate features, brainstormed later.
- Online verification (Absher, PACI, Nafath). Dualkit stays offline and dependency-free.
- Passports and visa numbers.

## Anti-goals

- Rejecting a real person's ID. Where the rules are unclear, check less, not more.
- Claiming a checksum where none is public.
- Any real person's ID in fixtures, demos or docs.

## What each country gets

| Country | Code | Rules | `strength` | Decoded fields |
| --- | --- | --- | --- | --- |
| UAE | `AE` | 15 digits, starts 784, Luhn | `checksum` | `year` |
| Saudi ID / Iqama | `SA` | 10 digits, starts 1 or 2, Luhn (community formula; official one is on request from the Ministry of Interior) | `checksum` | `holder: 'citizen' \| 'resident'` |
| Kuwait Civil ID | `KW` | 12 digits, digits 2–7 a valid YYMMDD birth date, mod-11 check digit (weights 2,1,6,3,7,9,10,5,8,4,2) | `checksum` | `birthDate` |
| Qatar QID | `QA` | 11 digits, starts 2 or 3 | `shape` | `birthYear` (2 digits), `nationality` (3-digit ISO numeric, decoded, not validated) |
| Bahrain CPR | `BH` | 9 digits | `shape` | none |

Sources: SAMA rulebook (Saudi structure), saudi-id-validator and similar libraries (Luhn), django-localflavor `kw` (Kuwait weights), Microsoft Purview QID definition, Wego CPR guide. Links in the brainstorm thread.

## Approaches

1. **One parser per country behind `parseNationalId(input, country)`.** Picked. Matches how Format already handles phones (`saudi-phone.ts`, `kuwait-phone.ts` behind `parseGulfPhone`), keeps each country's odd rules in its own file, and gives typed, country-specific results.
2. A single data table and generic parser. Rejected: birth dates, holder type and nationality codes don't fit a table and would turn into special cases.
3. A component per country. Rejected: design engineers would pick between five components and rewire when the country changes.

## Design

**Format** (`packages/format/src`)

- New files `saudi-id.ts`, `kuwait-civil-id.ts`, `qatar-id.ts`, `bahrain-cpr.ts`, and `national-id.ts` with `parseNationalId`, `isValidNationalId`, `formatNationalId` and `NATIONAL_ID_COUNTRIES`.
- `NationalIdCountry = Exclude<GulfCountry, 'OM'>`.
- Every parser uses the shared `Result`, accepts Arabic digits, spaces and dashes (like `parseEmiratesId`), and returns `{ country, digits, formatted, strength, ...decoded }`, a union discriminated by `country`.
- Shared error codes: `empty`, `invalid_characters`, `invalid_length`, `invalid_prefix`, `invalid_checksum`, plus `invalid_birth_date` for Kuwait. Default messages are English and name the document ("A Saudi ID or Iqama has 10 digits.").
- `parseEmiratesId` and its exports stay unchanged. `parseNationalId(x, 'AE')` delegates to it.
- Also exported on their own: `parseSaudiId`, `parseKuwaitCivilId`, `parseQatarId`, `parseBahrainCpr`.

**Component** (`packages/starter/gulf/gulf-national-id-input.tsx`)

- New `country?: NationalIdCountry` prop, default `'AE'`, so existing installs behave the same.
- Placeholder and as-you-type grouping come from the country. `onResult` gets the `parseNationalId` result. `errorMessages` is keyed by the shared codes.
- Rebuild the registry JSON with `packages/starter/scripts/registry.mjs`.

**MCP** (`packages/mcp/src/tools/validate.ts`)

- New kind `national_id` with a required `country`. `emirates_id` stays as is for existing callers. Update the tool and server descriptions.

**Samples**

- One synthetic generator per country that produces valid numbers (correct checksums, real birth dates). Tests, `GulfDemos` and `apps/figma/src/samples.ts` use it, so design and code show the same kind of value.

**Site and announce**

- Country switcher on the national ID demo in `/components/gulf`, in English and Arabic.
- Update `gulf-copy.ts`, `/docs`, the README rows ("Emirates ID for now" goes), the package READMEs, `/updates`, and the roadmap item "More Gulf formats" (IDs done; Iqama listed, address and `parseMoney` still coming).
- Recount the test strip.

**Releases**

- `@dualkit/format` 0.3.0-beta.0, `@dualkit/mcp` 0.2.0-beta.0.

## Tests

- Test first, per parser: every error code, Arabic-digit input, separators, and the decoded fields.
- Saudi vectors from the public libraries: `1012345672` passes (citizen), `2100000005` passes (resident), `1012345671` fails the checksum.
- Kuwait: generated vectors checked against django-localflavor's implementation, plus an invalid birth date and the remainder cases below.
- The component, the MCP kind and the samples generator each get tests in their existing suites.

## Calls made while writing (check these)

- **Kuwait remainder edge cases.** When `11 − (sum mod 11)` comes out as 10 or 11, the builder copies django-localflavor's handling exactly and writes a test for it. No rule of our own.
- **Qatar nationality code** is decoded and returned, not checked against an ISO list, so stateless or unusual codes never get rejected.
- **Bahrain** gets a length check only. Its first four digits are often a birth year and month, but personal numbers can be bought, so the date isn't enforced.
- **Grouping.** UAE keeps its dashes. The other four show plain digits, because their cards print them ungrouped.
- **Saudi strength** is reported as `checksum`, and the README says the formula is the community one.
- **Doc location** is `docs/plans/`, to match the existing design docs.

## Left to the builder

- Internal helper names and how the mod-11 weights are shared.
- Placeholder sample values, taken from the synthetic generator.
- Exact English wording of the default messages, under the site copy rules (sentence case, no em dashes).
