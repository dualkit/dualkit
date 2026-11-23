# Gulf national IDs implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read national IDs for the UAE, Saudi Arabia, Kuwait, Qatar and Bahrain in `@dualkit/format`, and use them in the shadcn input, the MCP server, the Figma samples and the site.

**Architecture:** One parser per country, each returning the shared `Result`. The `parseNationalId(input, country)` dispatcher tags every result with `country` and `strength`. The other surfaces consume only the dispatcher and its types.

**Tech stack:** TypeScript, Vitest, React and Testing Library (starter), zod and the MCP SDK (mcp), Next.js (site).

**Spec:** `docs/plans/2026-11-23-gulf-national-ids-design.md`

## Global constraints

- `@dualkit/format` stays dependency-free and offline.
- No Oman. `NationalIdCountry = 'AE' | 'SA' | 'KW' | 'QA' | 'BH'`.
- `parseEmiratesId`, `isValidEmiratesId`, `formatEmiratesId` and the `emirates_id` MCP kind stay unchanged.
- Every parser accepts Arabic digits, spaces and dashes, like `parseEmiratesId` (`toWesternDigits`, then `/^[\d\s-]+$/`, then strip non-digits).
- Check order in every parser: `empty`, `invalid_characters`, `invalid_length`, `invalid_prefix`, `invalid_birth_date` (Kuwait only), `invalid_checksum`.
- Only synthetic IDs in tests, demos and docs. Use the vectors in this plan.
- Copy rules: sentence case, no em dashes. New Arabic strings are drafts. Never describe them as reviewed by a native speaker.
- Commits: `feat:`, `docs:` and so on, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on a branch, never on `main`.
- Versions: `@dualkit/format` 0.3.0-beta.0, `@dualkit/mcp` 0.2.0-beta.0.

## Test vectors (all synthetic)

| Country | Valid | Invalid |
| --- | --- | --- |
| SA | `1012345672` (citizen), `2100000005` (resident) | `1012345671` checksum, `3012345672` prefix |
| KW | `290010112346` (born 1990-01-01), `305122500019` (born 2005-12-25) | `290010112347` checksum; `29001011237x` and `29001011232x` for every x (the weighted value comes out as 11 or 10, which no digit can match); `290023012345` birth date (30 February); `490010112346` prefix |
| QA | `29063412345` (born 90, nationality 634) | `19063412345` prefix |
| BH | `900112345` | `90011234` length |
| AE | `784199012345676` | as in `emirates-id.test.ts` |

## Review focus

1. **A country switch mid-typing in the input:** the stored value is trimmed to the new country's length and re-validated. No stale result. Test in Task 5.
2. **Arabic-digit input for every country:** `٢٩٠٠١٠١١٢٣٤٦` parses the same as the Western digits. Test in Tasks 1–3.
3. **Kuwait numbers where the weighted value comes out as 10 or 11:** always `invalid_checksum`, never an exception and never accepted. Test in Task 2.
4. **`country: 'OM'` or a missing country in MCP `national_id`:** a plain tool error naming the supported countries, not a crash or a silent fallback to UAE. Test in Task 6.
5. **An existing UAE install that sets no `country`:** same placeholder behaviour and hyphenation as today. `onResult` now carries the extra `country` and `strength` fields. Test in Task 5.

---

### Task 1: Saudi ID and Iqama parser

**Files:**
- Create: `packages/format/src/saudi-id.ts`
- Test: `packages/format/test/saudi-id.test.ts`

**Interfaces:**
- Produces: `type SaudiId = { readonly digits: string; readonly formatted: string; readonly holder: 'citizen' | 'resident' }`, `type SaudiIdError = 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix' | 'invalid_checksum'`, `parseSaudiId(input: string): Result<SaudiId, SaudiIdError>`.

- [ ] **Step 1: Write the failing tests.** Use the `emirates-id.test.ts` style:
  - `it.each(['1012345672', '101 234 5672', '١٠١٢٣٤٥٦٧٢'])` returns `{ ok: true, value: { digits: '1012345672', formatted: '1012345672', holder: 'citizen' } }`.
  - `'2100000005'` returns `holder: 'resident'`.
  - `'1012345671'` returns code `invalid_checksum`. `'3012345672'` returns `invalid_prefix`. `'101234567'` returns `invalid_length`. `''` returns `empty`. `'10123A5672'` returns `invalid_characters`.
- [ ] **Step 2: Run** `npm test -w @dualkit/format -- saudi-id`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `parseSaudiId`.** Length 10, first digit `1` (citizen) or `2` (resident), checksum `passesLuhn` from `./luhn`. `formatted` is the digits, ungrouped. English messages name the document, for example "A Saudi ID or Iqama has 10 digits." and "A Saudi ID starts with 1, an Iqama with 2."
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: read Saudi ID and Iqama numbers in format`.

### Task 2: Kuwait Civil ID parser

**Files:**
- Create: `packages/format/src/kuwait-civil-id.ts`
- Test: `packages/format/test/kuwait-civil-id.test.ts`

**Interfaces:**
- Produces: `type KuwaitCivilId = { readonly digits: string; readonly formatted: string; readonly birthDate: string }` (ISO `YYYY-MM-DD`), `type KuwaitCivilIdError = SaudiIdError | 'invalid_birth_date'`, `parseKuwaitCivilId(input: string): Result<KuwaitCivilId, KuwaitCivilIdError>`.

- [ ] **Step 1: Write the failing tests:**
  - `'290010112346'` and `'٢٩٠٠١٠١١٢٣٤٦'` return `birthDate: '1990-01-01'`.
  - `'305122500019'` returns `'2005-12-25'`.
  - `'290010112347'` returns `invalid_checksum`.
  - `it.each` over `0`–`9` appended to `'29001011237'` and to `'29001011232'` all return `invalid_checksum`.
  - `'290023012345' (30 February)` returns `invalid_birth_date`. `'490010112346'` returns `invalid_prefix`. `'29001011234'` returns `invalid_length`.
- [ ] **Step 2: Run** `npm test -w @dualkit/format -- kuwait-civil-id`. Expected: FAIL.
- [ ] **Step 3: Implement.** This follows django-localflavor `kw/utils.py` exactly:

```ts
// First digit is the century: 1 → 18xx, 2 → 19xx, 3 → 20xx. Digits 2–7 are YYMMDD.
const WEIGHTS = [2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const
const check = 11 - (WEIGHTS.reduce((s, w, i) => s + w * Number(digits[i]), 0) % 11)
// check is 10 or 11 for some numbers. No single digit equals it, so those fail as invalid_checksum.
valid = check === Number(digits[11])
```

  Validate the birth date by building a UTC `Date` and confirming that year, month and day round-trip. `formatted` is the digits, ungrouped.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: read Kuwait Civil ID numbers in format`.

### Task 3: Qatar QID and Bahrain CPR parsers (shape only)

**Files:**
- Create: `packages/format/src/qatar-id.ts`, `packages/format/src/bahrain-cpr.ts`
- Test: `packages/format/test/qatar-id.test.ts`, `packages/format/test/bahrain-cpr.test.ts`

**Interfaces:**
- Produces: `type QatarId = { readonly digits: string; readonly formatted: string; readonly birthYear: string; readonly nationality: string }` (`birthYear` is the two digits as printed, `nationality` the 3-digit ISO numeric code, neither validated), `type QatarIdError = 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix'`, `parseQatarId(input: string): Result<QatarId, QatarIdError>`.
- Produces: `type BahrainCpr = { readonly digits: string; readonly formatted: string }`, `type BahrainCprError = 'empty' | 'invalid_characters' | 'invalid_length'`, `parseBahrainCpr(input: string): Result<BahrainCpr, BahrainCprError>`.

- [ ] **Step 1: Write the failing tests:**
  - `'29063412345'` and its Arabic-digit form return `{ digits: '29063412345', formatted: '29063412345', birthYear: '90', nationality: '634' }`. `'19063412345'` returns `invalid_prefix`. `'2906341234'` returns `invalid_length`.
  - `'900112345'` returns `{ digits: '900112345', formatted: '900112345' }`. `'90011234'` returns `invalid_length`.
  - A test asserts that `'29099912345'` (nationality 999) is accepted, which pins "decode, don't validate".
- [ ] **Step 2: Run** `npm test -w @dualkit/format -- qatar-id bahrain-cpr`. Expected: FAIL.
- [ ] **Step 3: Implement.** Qatar: 11 digits, first digit `2` or `3`, `birthYear = digits.slice(1, 3)`, `nationality = digits.slice(3, 6)`. Bahrain: 9 digits only.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: read Qatar QID and Bahrain CPR numbers in format`.

### Task 4: `parseNationalId`, exports, README and version

**Files:**
- Create: `packages/format/src/national-id.ts`
- Modify: `packages/format/src/index.ts`, `packages/format/README.md`, `packages/format/package.json` (version `0.3.0-beta.0`)
- Test: `packages/format/test/national-id.test.ts`

**Interfaces:**
- Consumes: the Task 1–3 parsers, plus `parseEmiratesId` and `EmiratesId`.
- Produces:

```ts
export type NationalIdCountry = 'AE' | 'SA' | 'KW' | 'QA' | 'BH'
export const NATIONAL_ID_COUNTRIES: readonly NationalIdCountry[]   // in that order
export type NationalIdStrength = 'checksum' | 'shape'
export type NationalIdError = 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix' | 'invalid_birth_date' | 'invalid_checksum'
export type NationalId =
  | ({ readonly country: 'AE'; readonly strength: 'checksum' } & EmiratesId)
  | ({ readonly country: 'SA'; readonly strength: 'checksum' } & SaudiId)
  | ({ readonly country: 'KW'; readonly strength: 'checksum' } & KuwaitCivilId)
  | ({ readonly country: 'QA'; readonly strength: 'shape' } & QatarId)
  | ({ readonly country: 'BH'; readonly strength: 'shape' } & BahrainCpr)
export const NATIONAL_ID_LENGTH: Record<NationalIdCountry, number>      // AE 15, SA 10, KW 12, QA 11, BH 9
export const NATIONAL_ID_EXAMPLES: Record<NationalIdCountry, string>    // the valid vectors above, as digits
export function parseNationalId(input: string, country: NationalIdCountry): Result<NationalId, NationalIdError>
export const isValidNationalId: (input: string, country: NationalIdCountry) => boolean
export function formatNationalId(input: string, country: NationalIdCountry): string | null
```

- [ ] **Step 1: Write the failing tests:**
  - `it.each(NATIONAL_ID_COUNTRIES)`: `parseNationalId(NATIONAL_ID_EXAMPLES[c], c)` is ok, with `value.country === c` and `value.digits.length === NATIONAL_ID_LENGTH[c]`.
  - `strength` is `'checksum'` for AE, SA and KW, and `'shape'` for QA and BH.
  - `parseNationalId('784199012345676', 'AE').value` equals `{ country: 'AE', strength: 'checksum', ...parseEmiratesId('784199012345676').value }`.
  - A Saudi number parsed as `'KW'` returns `invalid_length`.
  - `formatNationalId('784199012345676', 'AE')` returns `'784-1990-1234567-6'`. An invalid ID returns `null`.
  - The `package.test.ts` export check, if it lists exports, includes the new names.
- [ ] **Step 2: Run** `npm test -w @dualkit/format`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use a `switch` on `country` that calls the parser and spreads `{ country, strength }` onto `ok` values, passing errors through. Export everything above, plus each country parser and its types, from `index.ts`.
- [ ] **Step 4: Update the README.** Add a national IDs section with a table of country, document, check (checksum or shape), and decoded fields. Add a line saying the Saudi formula is the community Luhn check (the official one is available only on request from the Ministry of Interior), and one saying Oman is not covered yet.
- [ ] **Step 5: Run** `npm test -w @dualkit/format && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: add parseNationalId for five Gulf countries`.

### Task 5: Country-aware `gulf-national-id-input`

**Files:**
- Modify: `packages/starter/gulf/gulf-national-id-input.tsx`, `packages/starter/test/gulf/gulf-national-id-input.test.tsx`
- Regenerate: `apps/site/public/r/gulf-national-id-input.json` via `packages/starter/scripts/registry.mjs` (run as `registry.test.ts` expects)

**Interfaces:**
- Consumes: `parseNationalId`, `NATIONAL_ID_LENGTH`, `NATIONAL_ID_EXAMPLES`, `NationalIdCountry`, `NationalId`, `NationalIdError` from `@dualkit/format`.
- Produces: `GulfNationalIdResult = Result<NationalId, NationalIdError>`, and the props `GulfFieldText<NationalIdError> & { value; onChange; onResult?; numerals?; country?: NationalIdCountry }`, with `country` defaulting to `'AE'`.

- [ ] **Step 1: Update the tests.** Change the existing "reports the parsed ID" expectation to include `country: 'AE', strength: 'checksum'`. Add:
  - With `country="SA"`, typing `'1012345672'` shows `'1012345672'` with no hyphens and calls `onResult` with `value.holder === 'citizen'`.
  - With `country="KW"`, typing 13 digits stores only the first 12.
  - With no `placeholder` prop, the placeholder is the country's example (UAE shows `784-1990-1234567-6`, SA shows `1012345672`). An explicit `placeholder` wins.
  - **Review focus 1:** rerender from `country="AE"` with value `'784199012345676'` to `country="SA"`. `onChange` is called with the first 10 digits and the shown error reflects the Saudi parse.
  - The existing axe check runs once per country in both scripts.
- [ ] **Step 2: Run** `npm test -w @dualkit/starter -- gulf-national-id-input`. Expected: FAIL.
- [ ] **Step 3: Implement.** Mask length from `NATIONAL_ID_LENGTH[country]`. `display` hyphenates only for `'AE'`, using the current `GROUPS`. Other countries show plain digits. The default placeholder is `formatNationalId(NATIONAL_ID_EXAMPLES[country], country)` passed through `withNumerals`. A `useEffect` on `country` trims an over-long `value` through `onChange`. Remove the "Saudi ID and Iqama wait" comment.
- [ ] **Step 4: Regenerate the registry JSON and run** `npm test -w @dualkit/starter`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: national ID input for five Gulf countries`.

### Task 6: MCP `national_id` kind

**Files:**
- Modify: `packages/mcp/src/tools/validate.ts`, `packages/mcp/src/server.ts` (the `INSTRUCTIONS` string), `packages/mcp/package.json` (version `0.2.0-beta.0`), `packages/mcp/README.md`
- Test: `packages/mcp/test/validate.test.ts`

**Interfaces:**
- Consumes: `parseNationalId`, `NATIONAL_ID_COUNTRIES`.

- [ ] **Step 1: Write the failing tests:**
  - `it.each(NATIONAL_ID_COUNTRIES)`: `call('validate', { kind: 'national_id', value: NATIONAL_ID_EXAMPLES[c], country: c })` equals `parseNationalId(...)`.
  - **Review focus 4:** `country: 'OM'` and a missing `country` each return a plain error matching `/AE, SA, KW, QA or BH/` (or whatever `oneOf` renders).
  - The existing `emirates_id` tests stay unchanged and passing.
- [ ] **Step 2: Run** `npm test -w @dualkit/mcp -- validate`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `'national_id'` to `KINDS`, and a `strictFor('national_id', { kind, value, country: z.enum(NATIONAL_ID_COUNTRIES, says(...)) })` branch with the country required. Update the tool description to name the five documents and say that QA and BH are shape-only checks. Add a sentence to `INSTRUCTIONS`.
- [ ] **Step 4: Update the README tool list. Run** `npm test -w @dualkit/mcp`, updating `__snapshots__` only where the description text changed. Expected: PASS.
- [ ] **Step 5: Commit** `feat: validate Gulf national IDs in the MCP server`.

### Task 7: Figma Fill Gulf samples

**Files:**
- Modify: `apps/figma/src/kinds.ts`, `apps/figma/src/samples.ts`, `apps/figma/test/samples.test.ts`

**Interfaces:**
- Consumes: `formatNationalId`, `isValidNationalId`.
- Produces: new `SampleKind` values `'national-id-sa' | 'national-id-kw' | 'national-id-qa' | 'national-id-bh'`, with labels "Saudi ID", "Kuwait Civil ID", "Qatar ID" and "Bahrain CPR". `'emirates-id'` is unchanged.

- [ ] **Step 1: Write the failing tests:**
  - For each new kind and every seed in `SEEDS`, `isValidNationalId(toWesternDigits(sample(kind, seed, style)), country)` is true.
  - Name rules: `'Iqama'` and `'Saudi ID'` map to `national-id-sa`, `'Civil ID'` to `national-id-kw`, `'QID'` to `national-id-qa`, `'CPR'` to `national-id-bh`. `'Emirates ID'`, `'EID'` and `'National ID'` still map to `emirates-id`.
- [ ] **Step 2: Run** `npm test -w apps/figma -- samples` (or the workspace name in `apps/figma/package.json`). Expected: FAIL.
- [ ] **Step 3: Implement the seeded generators** with the existing `Random`, `int`, `digits` and `required`:
  - SA: `1` or `2` plus 8 digits plus the Luhn digit, via the existing `luhnDigit`.
  - KW: century `2` or `3`, a real date in 1970–2005, 4 digits, then the mod-11 check. Redraw the 4 digits while the check is 10 or 11.
  - QA: `2`, two year digits, a nationality from `['634', '356', '586', '818']`, then 5 digits.
  - BH: 9 digits.

  Pass every value through `required(formatNationalId(...))`. Add `/iqama|إقامة|saudi id/i`, `/civil id|مدنية/i`, `/\bqid\b/i` and `/\bcpr\b/i` rules before the existing ID rule.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: Gulf national ID samples in the Figma plugin`.

### Task 8: Site demo, copy and announce surfaces

**Files:**
- Modify: `apps/site/components/gulf/GulfDemos.tsx`, `apps/site/lib/gulf-copy.ts`, `apps/site/app/docs/page.tsx`, `apps/site/lib/updates.ts`, `README.md`, `packages/starter/README.md` (if it lists the Gulf inputs), `apps/site/lib/counters.ts` (test counts)
- Test: the existing site tests, plus any that read `gulf-copy.ts`

- [ ] **Step 1: Country switcher in `NationalIdDemo`.** Add a segmented control for the five countries, labelled in the page language and passing `country` through. Pull label, help and errors per country from `gulf-copy.ts`.
- [ ] **Step 2: Copy.** Restructure `gulf-copy.ts` `'gulf-national-id-input'` as `en`/`ar` text per country, with error messages per `NationalIdError` code. Replace the `line` with one that names all five and says that Qatar and Bahrain get a shape check. Arabic strings are drafts.
- [ ] **Step 3: Announce surfaces.**
  - README: remove "(Emirates ID for now)" and name the five.
  - `/docs`: show a `parseNationalId` example.
  - `updates.ts`: add a release entry dated on ship day, for format 0.3.0-beta.0 and mcp 0.2.0-beta.0.
  - Roadmap "More Gulf formats": mark the ID step done, and keep address and amounts read from text as coming.
- [ ] **Step 4: Recount tests.** Run `npm test` and update the counters and the homepage test strip with the real totals from the output.
- [ ] **Step 5: Run** `npm run typecheck && npm run build`. Expected: PASS. Check `/components/gulf` in `npm run dev` in both languages.
- [ ] **Step 6: Commit** `docs: announce Gulf national IDs`.
