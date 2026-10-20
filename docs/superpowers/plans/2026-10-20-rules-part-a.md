# Rules Part A (rendered rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `@dualkit/rules` closes the gap map's blind spots and adds up to nine provable rendered rules. Then the CLI, the bench and the site ship the new set as rules 0.2.0-beta.0 and CLI 0.2.0-beta.0.

**Architecture:** The in-page reader (`packages/rules/src/dom`) adds new facts to `ScreenModel`. Rules stay pure functions over the model, in their group files under `src/rules`. Probes in `test/verify.test.ts` measure Chromium's paint for every rendering claim, and a rule ships only if the probe agrees with it.

**Tech Stack:** TypeScript, vitest, Playwright Chromium 1.55.0, tsup, esbuild (the reader bundle).

**Spec:** `docs/superpowers/specs/2026-10-20-rules-and-linter-design.md`, Part A plus "The proof standard" and "Calls settled after the builder check".

## Global Constraints

- Proof standard, from the spec:
  - Each new or changed rule has 1 firing fixture and at least 2 that do not, one of them the nearest correct pattern.
  - Every rendering claim has a Chromium probe in `test/verify.test.ts`.
  - Every fact is cited in `docs/research/2026-10-20-rules-facts.md` and marked VERIFIED.
  - A candidate that fails its proof is dropped. Log `Dropped: <id>: <why>` in the task report, and add a "Known limits" line in RULES.md if users would expect the rule.
- Rule ids and severities exactly as the spec's tables. Copy is in the existing voice: plain English, no em dashes, `why` and `fix` are one sentence each.
- `FIXTURES` in `packages/rules/test/fixtures.ts` gets a `bad`/`good` pair for every new rule. Its coverage test, and every literal rule count, change to the new total in the same task. The literal counts are in `test/fixtures.test.ts`, `test/rules/content.test.ts` and `packages/skills/test/render.test.ts`.
- RULES.md is regenerated with `UPDATE_RULES_MD=1 npm test -w @dualkit/rules -- docs`.
- The skills render test (`npm test -w @dualkit/skills`) must stay green, because good skill examples must pass every rule. If a new rule fails a skill example, decide which is wrong: a real bug in the example is fixed in the skill, and a false positive is fixed in the rule. Say which in the report.
- The reader stays one in-page script with no Node imports. The 5,000-rule timing test in `reader.test.ts` must still pass.
- After each task, all of these pass: `npm test -w @dualkit/rules`, `npm test -w @dualkit/skills`, `npm test -w dualkit`, `npm run typecheck -w @dualkit/rules`.
- Commits use `feat:`/`fix:`/`test:`/`docs:`/`chore:` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A page that loads its Arabic webfont through a Google Fonts `<link>` passes `type/arabic-font` once `document.fonts.ready` resolves. It must not fail because the read raced the font (Task 2's wait plus the probe in Task 3).
2. A stack that names a platform Arabic font without loading it (`"SF Arabic", "Segoe UI", sans-serif`) passes, because those come with the operating system. `"IBM Plex Sans Arabic", sans-serif` with no `@font-face` fails with the "named but not loaded" message (Task 3).
3. A label cut off on purpose with `text-overflow: ellipsis` does not fire `layout/clipped-text`. A visually hidden `.sr-only` element does not either (Task 6).
4. An Arabic word whose second half is only a different colour (`<span style="color:red">`) does not fire `type/arabic-broken-join` (Task 7).
5. An `aria-label` that is a brand name in Latin on an Arabic page, such as "Dualkit" or "Visa", does not fire `content/label-language`. Only labels with at least 2 words in the other script count (Task 5).

---

### Task 1: Facts research

**Files:**
- Create: `docs/research/2026-10-20-rules-facts.md`

Web research only, no code. For each fact, record the claim, the source URL, the date checked and a confidence (VERIFIED / SECONDARY / UNVERIFIED), in the format of `docs/research/2026-10-19-gcc-facts.md`.

- [ ] Step 1: **System fonts with Arabic coverage.** For each platform, list the font families that ship with Arabic glyphs, from vendor pages:
  - macOS and iOS: Apple's font list
  - Windows 10 and 11: Microsoft's "Windows font list"
  - Android: Noto in AOSP
  - ChromeOS

  Give the CSS family names exactly as `font-family` would name them. The generic keywords `system-ui`, `-apple-system` and `BlinkMacSystemFont` resolve to a system font that may or may not have Arabic. Say so with sources, and do not list them as Arabic families.
- [ ] Step 2: **CBUAE dirham sign guideline.** Find the Central Bank of the UAE's dirham symbol usage guideline (PDF, 2025). Quote its rules on pairing the sign with "AED", "Dh" or the Arabic word, if it has them. VERIFIED only if quoted from the CBUAE document itself.
- [ ] Step 3: **Unicode.** Confirm U+20C1, U+20C3 and U+20C4 are assigned, with the version of each, and the name of U+FDFC, from the Unicode 18 UCD. Reuse the GCC facts file where it already has these.
- [ ] Step 4: **Screen readers and `lang`.** Find one authoritative source (WAI, MDN, WCAG 3.1.2 understanding doc) that says a screen reader picks its voice and pronunciation from the element's language, so an English `aria-label` inside `lang="ar"` is read with Arabic rules.
- [ ] Step 5: Commit `docs: facts for project 3 rules`.

### Task 2: Reader foundation: fonts, labels, placeholders, clips, mirrored text

**Files:**
- Modify: `packages/rules/src/model.ts`, `src/dom/reader.ts`, `src/dom/icons.ts` (export the mirror test), `src/dom/types.ts`
- Create: `src/dom/fonts.ts`, `src/dom/labels.ts`, `src/dom/clips.ts`
- Modify: `packages/cli/src/audit.ts`, `packages/bench/src/score.ts`, `packages/rules/test/helpers/browser.ts` and the skills test's page loader. All of them wait for fonts before reading.
- Create: `packages/rules/test/fonts/IBMPlexSansArabic-Regular.woff2`, `test/fonts/IBMPlexSansArabic-Bold.woff2`, `test/fonts/OFL.txt`. These are the OFL fonts from the IBM Plex release, with a source line in a README next to them.
- Modify: `packages/rules/test/fixtures.ts` (`page()` injects `@font-face` for IBM Plex Sans Arabic 400 and 700 from data URLs)
- Test: `test/reader.test.ts`

**Interfaces (Produces):**
- `type LoadedFace = { family: string; weight: [number, number]; style: string; unicodeRange: string; sizeAdjust: number; status: 'unloaded' | 'loading' | 'loaded' | 'error' }`. `sizeAdjust` is a ratio, so 0.9 for `90%`. `family` has no quotes.
- `type LabelNode = NodeRef & { attr: 'aria-label' | 'alt' | 'title'; text: string; lang: string | null }`. `lang` is from the nearest `[lang]`.
- `type ClipNode = NodeRef & { axis: 'x' | 'y'; hidden: number; ellipsis: boolean; hasArabic: boolean }`. `hidden` is the px cut off: `scrollWidth - clientWidth` or `scrollHeight - clientHeight`.
- `FieldNode` gains `placeholder: string`. `TextRun` gains `mirrored: boolean`, from the icon mirror test applied up to 4 ancestors.
- `ScreenModel` gains `fonts: LoadedFace[]`, `labels: LabelNode[]` and `clips: ClipNode[]`.
- `export const FONT_WAIT_MS = 3000`, and `waitForFonts(page)` in each loader: `await page.evaluate(() => document.fonts.ready)` raced against `FONT_WAIT_MS`, never throwing.

- [ ] Step 1: Write reader tests:
  - `fonts` lists the fixture's IBM Plex faces with `status: 'loaded'`, `weight: [400, 400]` and `[700, 700]`.
  - A `size-adjust: 90%` face reads `sizeAdjust: 0.9`.
  - `labels` reads `aria-label`, `alt` and `title`, and skips empty values.
  - A field's `placeholder` is read.
  - A 60px `overflow:hidden` box with 200px of text gives one `ClipNode` with `axis: 'x'` and `hidden > 100`. The same box with `text-overflow: ellipsis; white-space: nowrap` gives `ellipsis: true`. An `overflow: visible` box gives none.
  - Text inside `transform: scaleX(-1)` reads `mirrored: true`.
- [ ] Step 2: Run `npm test -w @dualkit/rules -- reader`. Expect FAIL.
- [ ] Step 3: Implement. Clips are read only for elements with their own text, `overflow-x` or `overflow-y` of `hidden` or `clip`, and a gap of more than 1px. Skip anything that `screenReaderOnly` already skips.
- [ ] Step 4: Add `waitForFonts` to the four loaders.
- [ ] Step 5: Run the global test set. Expect PASS.
- [ ] Step 6: Commit.

### Task 3: Font rules: `type/arabic-font`, `type/arabic-size` with `size-adjust`, `type/arabic-faux-bold`

**Files:**
- Modify: `packages/rules/src/text.ts` (split `ARABIC_FONT` into `ARABIC_FAMILY_NAME`, which names Arabic families, and `SYSTEM_ARABIC_FONTS`, the exact list from Task 1. `segoe ui`, `system-ui` and `-apple-system` move out of the regex and into the system list only if Task 1 shows they have Arabic.)
- Modify: `src/rules/type.ts`. Create `src/fonts.ts`, with pure helpers over `LoadedFace[]`.
- Test: `test/rules/type.test.ts`, `test/verify.test.ts`, `test/fixtures.ts`

**Interfaces:**
- Consumes: `ScreenModel.fonts` (Task 2).
- Produces:
  - `coversArabic(face: LoadedFace): boolean`. True when the unicode-range includes U+0627, or the range is `U+0-10FFFF`.
  - `loadedArabicFace(families: string[], fonts: LoadedFace[]): LoadedFace | null`
  - `effectiveSize(run: TextRun, fonts: LoadedFace[]): number`

- [ ] Step 1: Tests:
  - **arabic-font:**
    - The stack `IBM Plex Sans Arabic` with a loaded face passes.
    - The same name with no face fails with the message `"IBM Plex Sans Arabic" is named but never loaded`.
    - `Inter, sans-serif` fails as today, with `Arabic falls back from …`.
    - `"SF Arabic", "Segoe UI", sans-serif` passes if Task 1 confirms both.
    - `system-ui` alone fails.
    - A face with status `error` counts as not loaded.
  - **arabic-size:**
    - 13px with a loaded first-family face at `sizeAdjust: 1.1` passes, because the effective size is 14.3.
    - 15px at 0.9 fails, because it is 13.5. The message shows both numbers.
  - **arabic-faux-bold:**
    - A weight-700 run with only a 400 face loaded fails.
    - With a 700 face loaded it passes.
    - A system font with no faces is never judged.
    - A variable face with `weight: [100, 900]` passes.
- [ ] Step 2: Write the probe in `verify.test.ts`. A page loads IBM Plex Sans Arabic only from a `@font-face` with `font-display: swap`, read through `modelOf` after the fonts wait. It must show `status: 'loaded'` and no `type/arabic-font` finding. This pins Review Focus 1.
- [ ] Step 3: Implement, add fixtures, regenerate RULES.md, update the counts (+1).
- [ ] Step 4: Run the global test set. Commit.

### Task 4: Bidi: blind spots and `bidi/field-placeholder`

**Files:** `src/text.ts`, `src/rules/bidi.ts`, `test/rules/bidi.test.ts`, `test/verify.test.ts`, `test/fixtures.ts`

- [ ] Step 1: **`unisolated-latin`.** `LATIN_TOKEN` also matches codes with one capital, a hyphen or no separator, and 3 or more digits (`#A-10293`, `A10293`). Test both. As near-misses, `Visa` and a lone `A1` must not match.
- [ ] Step 2: **Arabic-Indic digit groups.** The comment on `GROUPED_NUMBER` records a measurement that isolation changes nothing for groups of Arabic-Indic digits. Re-measure it with a probe that uses `charBoxes` on `<p>رقم ٠٥٠ ١٢٣ ٤٥٦٧</p>` with and without `<bdi>`. If isolation changes the paint order, extend the rule and update the comment. If it doesn't, keep the rule, extend the comment with the probe, and log it as `Dropped: arabic-indic groups: <measurement>`.
- [ ] Step 3: **`punctuation-flip` beyond the last run.** Write probes for a closing mark before a `<br>`, and for a mark at the end of a non-last inline run inside an RTL block, such as `<p>السعر (AED) <b>١٠٠</b></p>`. Extend the rule only for the shapes where `markEdge` shows a flip. Otherwise add a RULES.md "Known limits" line and log the drop.
- [ ] Step 4: **New rule `bidi/field-placeholder`** (warning). It fires on a field with `dir` resolving to `ltr` (the attribute or computed) whose `placeholder` `hasArabic`.
  - Probe: measure that the Arabic placeholder paints flush left in an `ltr` email field.
  - Fix text: `Keep dir="ltr" for what people type, and right-align the Arabic hint with input:placeholder-shown { direction: rtl }.`
  - Probe that this fix paints the placeholder flush right and leaves the typed value `ltr`.
  - Negatives: a Latin placeholder in an `ltr` field, and an Arabic placeholder in an `rtl` text field.
- [ ] Step 5: Fixtures, RULES.md, counts. Run the global test set. Commit.

### Task 5: Content: `old-rial-sign`, `currency-sign-font`, `dirham-sign-with-code`, `label-language`

**Files:** `src/rules/content.ts`, `src/text.ts`, `test/rules/content.test.ts`, `test/fixtures.ts`

- [ ] Step 1: **`content/old-rial-sign`** (warning). Fires on any `TextRun` containing U+FDFC.
  - Message: `﷼ is the rial ligature, not the Saudi riyal sign.`
  - Fix: `Use ⃁ (U+20C1) for the Saudi riyal with a font that has it, or write ر.س or SAR.`
  - Negative: ر.س.
- [ ] Step 2: **`content/currency-sign-font`** (warning). Fires when a run contains U+20C1, U+20C3 or U+20C4 and no `LoadedFace` in its family stack with status `loaded` has a unicode-range covering that code point.
  - Write a `coversCodePoint(face, cp)` helper that parses ranges, wildcards (`U+20C?`) and lists.
  - Negatives: a face whose range is `U+20C0-20CF`, and a face with no range (all code points), both loaded.
- [ ] Step 3: **`content/dirham-sign-with-code`** (note). Only if Task 1 marked the CBUAE pairing rule VERIFIED. It fires when U+20C3 and `AED`, `Dh` or `درهم` appear in the same run. If the rule isn't verified, log `Dropped`.
- [ ] Step 4: **`content/label-language`** (warning). Fires on a `LabelNode` where the label's script disagrees with the language it's read in. That means at least 2 Latin words with an Arabic `lang` (`isArabicScriptLang`), or at least 2 Arabic words with a non-Arabic `lang`.
  - Negatives: `aria-label="Dualkit"`, `alt="Visa"`, and an Arabic label on `lang="ar"`. This pins Review Focus 5.
  - The `why` cites Task 1, step 4.
- [ ] Step 5: Fixtures, RULES.md, counts. Run the global test set. Commit.

### Task 6: Layout: `mirrored-text`, `clipped-text`, and icon naming

**Files:** `src/rules/layout.ts`, `src/dom/icons.ts`, `test/rules/layout.test.ts`, `test/rules/icons.test.ts`, `test/verify.test.ts`, `test/fixtures.ts`

- [ ] Step 1: **`layout/mirrored-text`** (error). Fires on a `TextRun` with `mirrored: true`, once per nearest mirrored ancestor.
  - Negatives: a mirrored icon with no text, and text inside `scaleX(-1)` that is flipped back by `scaleX(-1)` again. Handle the double flip by multiplying the signs across ancestors in the reader.
- [ ] Step 2: **`layout/clipped-text`** (warning). Fires on a `ClipNode` with `!ellipsis` and `hidden > 2`.
  - Probes:
    - An Arabic button label wider than its fixed-width box paints past the edge and gets cut.
    - A one-line Arabic label at `line-height: 1` in a box with `overflow: hidden` and `height: 1em` loses the dots below. Measure with `charBoxes` against the box.
  - Negatives:
    - `text-overflow: ellipsis`
    - `.sr-only`
    - a scrolling container (`overflow: auto`)
  - This pins Review Focus 3.
- [ ] Step 3: **Icon naming.**
  - `iconName` also reads `title` on the element, an SVG `<title>` child, and an `aria-label` on the nearest `button` or `a` ancestor when the icon has no name of its own.
  - Test: an unnamed inline SVG chevron inside `<button aria-label="Next">` is named `next` and fires `icons/not-mirrored` in RTL.
  - Add a RULES.md "Known limits" line saying a fully unnamed SVG is not recognised.
- [ ] Step 4: Fixtures, RULES.md, counts. Run the global test set. Commit.

### Task 7: `type/arabic-broken-join`

**Files:**
- Create: `src/dom/joins.ts`
- Modify: `src/model.ts` (`ScreenModel` gains `joins: JoinBreak[]`), `src/rules/type.ts`
- Test: `test/verify.test.ts`, `test/rules/type.test.ts`, `test/fixtures.ts`

**Interfaces:** `type JoinBreak = NodeRef & { reason: 'inline-block' | 'font-family' | 'other'; word: string }`

- [ ] Step 1: Probe the boundary between two adjacent text nodes inside one Arabic word, such as `مر` + `حبا`. Compare the second node's first-glyph box widths against the same word unsplit. The joining form is narrower or wider than the isolated form, and `charBoxes` measures that. Measure these cases:
  - `<b>`
  - a colour-only `<span>`
  - `display:inline-block`
  - `display:inline-flex`
  - a different `font-family`
  - `padding-inline-start: 2px`

  Record each case as joins or breaks.
- [ ] Step 2: The reader reports a `JoinBreak` only for the cases the probe shows break, using the matching `reason`. The rule (error) fires on each one.
  - The colour-only case must not fire, which pins Review Focus 4.
  - If no case breaks in Chromium, drop the rule and log it.
- [ ] Step 3: Fixtures, RULES.md, counts. Run the global test set. Commit.

### Task 8: Dogfood, release surfaces and versions

**Files:**
- Modify: `packages/rules/package.json` (0.2.0-beta.0)
- Modify: `packages/cli/package.json` (0.2.0-beta.0; dependency `@dualkit/rules` 0.2.0-beta.0)
- Modify: `packages/cli/README.md`, `apps/site/lib/v3/copy.ts`, `apps/site/lib/updates.ts`, `apps/site/app/docs/page.tsx` (if it lists rules or the count), `README.md` (if it quotes the count)
- Modify: `apps/site/lib/v3/testcount.ts`, regenerated with `node apps/site/scripts/count-tests.mjs`
- Modify: `plugin` version, if a skill example changed in Tasks 3 to 7
- Create: `docs/research/2026-10-20-rules-dogfood.md`

- [ ] Step 1: Build the site and serve it on a port (`npm run build -w @dualkit/site` then `next start`). Run `node packages/cli/dist/cli.js check <url>` on every route under `apps/site/app` (`/`, `/docs`, `/updates`, `/bench`, `/status`), with `--json`.
  - In the dogfood file, list each finding as a real bug or a false positive.
  - Fix real bugs in the site in their own `fix(site):` commits.
  - Report false positives as BLOCKED with the evidence. The controller rules on the rule change.
- [ ] Step 2: Replace "20 rules" with the real total wherever the earlier grep found it. Old /updates entries are left as written.
  - Add an /updates entry at the top: slug `rules-0-2-0`, today's date, tags `['Check']`.
  - The body lists the new rules in plain words and names every dropped candidate.
  - The roadmap's "Dualkit check" step `First 20 rules` stays, because it's history.
- [ ] Step 3: Run `npm test` in all workspaces, `npm run build`, and typecheck. Commit `chore: rules 0.2.0-beta.0 and CLI 0.2.0-beta.0`.
