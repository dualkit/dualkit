# GCC formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `@dualkit/format` covers phones and IBANs for all six GCC countries, and adds the Saudi VAT number, `gulfWeek`, `currencySign` and a required Hijri `timeZone`.

**Architecture:** New small modules in `packages/format/src`, re-exported from `index.ts`, following the existing `phone.ts` shape (Result type, error codes, plain-English messages). Docs and release surfaces are updated in a second task.

**Tech Stack:** TypeScript, vitest, tsup (existing package setup).

**Spec:** `docs/superpowers/specs/2026-10-19-gcc-formats-design.md`. Facts: `docs/research/2026-10-19-gcc-facts.md`.

## Global Constraints

- Only the prefixes, lengths and rules in the spec. No extra prefixes "to be safe" and none dropped.
- UAE and Saudi phone files and tests are not changed.
- Every new public function has a one-line JSDoc in the existing voice. No em dashes anywhere.
- `npm test -w @dualkit/format` and `npm run typecheck` (or the repo's equivalent `npm run check`) pass, and coverage does not drop.
- Commits use `feat:`/`docs:`/`chore:` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A Qatar, Kuwait, Bahrain or Oman number typed with a leading 0 is rejected (`unknown_prefix`), never silently read.
2. An 8-digit number with no country code passed to `parseGulfPhone` returns `needs_country_code`, never a guess.
3. Oman `900xxxxx` is rejected and `901xxxxx` accepted; Oman `73xxxxxx` rejected.
4. `isGulfWeekend` uses the given time zone's calendar day (23:30 UTC Thursday is Friday in Dubai).
5. `"971501234567"` typed without a plus still reads as UAE through the UAE function (existing behaviour unchanged).

---

### Task 1: Format package code

**Files:**
- Create: `packages/format/src/{qatar,kuwait,bahrain,oman}-phone.ts`, `gulf-phone.ts`, `saudi-vat.ts`, `week.ts`, `currency-sign.ts` (a shared helper file is allowed, see spec "Left to the builder")
- Modify: `packages/format/src/phone-input.ts` (a rule option so countries without a trunk 0 keep the leading 0 and fail), `iban.ts` (OM), `hijri.ts` (timeZone required), `index.ts`
- Test: one test file per new module in `packages/format/test/`, plus `iban.test.ts` and `hijri.test.ts` updates

**Interfaces (Produces):**
- `parse<Country>Phone(input: string): Result<<Country>Phone, <Country>PhoneError>`, `isValid<Country>Phone(input: string): boolean`, `format<Country>Phone(input: string, options?: { style?: 'national' | 'international' | 'e164' }): string | null` for Country in Qatar, Kuwait, Bahrain, Oman, with types `<Country>Phone`, `<Country>PhoneError`, `<Country>PhoneStyle`, `<Country>PhoneType`
- `parseGulfPhone(input: string): Result<GulfPhone, GulfPhoneError>`, `isValidGulfPhone(input: string): boolean`, `type GulfCountry = 'AE' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'`, `type GulfPhone = { country: GulfCountry; e164: string; type: 'mobile' | 'landline' | 'unknown' }`
- `parseSaudiVatNumber(input: string): Result<string, SaudiVatError>`, `isValidSaudiVatNumber(input: string): boolean`, `formatSaudiVatNumber(input: string): string | null`
- `gulfWeek(region: GulfRegion): GulfWeek`, `isGulfWeekend(date: Date, region: GulfRegion, options: { timeZone: string }): boolean`, `type GulfRegion = 'AE' | 'AE-SH' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'`, `type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7`, `type GulfWeek = { weekend: readonly Weekday[]; firstWorkday: Weekday }`
- `currencySign(currency: Currency): string | null`
- `GulfIbanCountry` gains `'OM'`; `HijriOptions = { readonly timeZone: string }`

- [ ] Step 1: Write failing tests per the spec's Tests section and the Review Focus list. Use the synthetic examples from the research file (section 1a table, section 2 synthetic IBANs, section 4a Saudi VAT examples).
- [ ] Step 2: Run `npm test -w @dualkit/format` and see them fail.
- [ ] Step 3: Implement.
- [ ] Step 4: Run the format tests, then the whole repo's tests and typecheck (the Hijri change touches starter and site call sites; they already pass timeZone, but types must still compile).
- [ ] Step 5: Commit.

### Task 2: Docs and release surfaces

**Files:**
- Modify: `packages/format/package.json` (version `0.2.0-beta.0`), `packages/format/README.md`, `plugin/skills/dualkit-gulf-formats/SKILL.md`, `cursor/rules/*.mdc` (regenerate with `npm run build -w @dualkit/skills-tooling`), `packages/skills/test/examples.ts` if quotes change, `apps/site/lib/updates.ts` (new release entry at the top, following the existing entry shape), `apps/site/app/docs/page.tsx` (format rows), the repo `README.md` only if it states format coverage.

- [ ] Step 1: Update the README coverage as a table by country (phone, IBAN, other), with examples for each new function and a short Hijri breaking-change note.
- [ ] Step 2: Update the skill's coverage line and import line. Keep under 900 words; `npm test -w @dualkit/skills` must pass (render test, ban scan, function check: every function the skill calls must be a real export).
- [ ] Step 3: Rebuild cursor rules; add the `/updates` entry; update the docs page rows.
- [ ] Step 4: Run all tests and the site build (`npm run build -w apps/site` or the repo's equivalent).
- [ ] Step 5: Commit.
