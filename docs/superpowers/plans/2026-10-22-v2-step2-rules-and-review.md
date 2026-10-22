# Dualkit v2 step 2: fewer errors, fewer misses, and the reviewer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise check and lint precision toward 90%, make check catch the planted Arabic bugs it misses today (including a new date-order rule), and add `dualkit check --review`, an open-code-review style reviewer that finds what fixed rules cannot see.

**Architecture:** Rule fixes and new rules go in `@dualkit/rules` (DOM reader plus Node rules) and `@dualkit/lint`. One behaviour probe (typing Arabic digits into code fields) goes in the CLI's `audit()`, because only a live page can show it. The reviewer lives in `packages/cli/src/review/`: it reuses `audit()`'s model, findings and screenshot, detects page features, picks only matching review rules, asks a vision model for findings tied to numbered elements, then a reflection pass re-checks each finding on a crop and drops what it cannot confirm. `@dualkit/eval` measures every step on a frozen case list.

**Tech Stack:** TypeScript, vitest 3, Playwright 1.55.0, tsup, parse5 (already in lint), OpenRouter and Gemini HTTP APIs through `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-22-dualkit-v2-design.md` (Part 2 steps 1 and 2, "Calls from the builder check"). Baseline: `docs/research/2026-10-22-v2-baseline.md`. Code map with file:line references: read `docs/superpowers/plans/2026-10-22-v2-step2-code-map.md` before any task.

## Global Constraints

- Bars, from the spec: at least 90% of what each tool reports at warning or error is real; Dualkit (check, lint and review together) finds at least 90% of the miss set. A rule under 90% is fixed, made a note, or turned off. "If a bar is missed, the report says so and that part ships off by default."
- The reviewer runs only with `--review`. Check and lint findings are never re-judged or removed by the reviewer.
- Review findings use check's finding shape, with `source: 'review'`, a `confidence` from 0 to 1, and `line` when a local source file is known.
- Model calls: free models first. Paid calls only from Sam's existing $10 OpenRouter credit, capped at $3 a month for Dualkit's own runs (eval, bench, CI), with every run logging what it spent. No new spend. Before the first paid call, confirm on OpenRouter's docs that spending credit keeps the 1,000 free-model requests a day, and record the answer in the step 2 report.
- Rule changes ship as a minor version with a changelog line in `apps/site/lib/updates.ts`. No CHANGELOG.md files exist; do not add one.
- A real bug: something an Arabic reader would see as wrong (the 20 Oct sweep test). Claude labels; Sam spot-checks 20 labels per set.
- Private data stays private: nothing from `~/Documents/Code/dualkit-sweep-data` (labels, site names, snippets) is committed. Committed numbers are aggregates per tool, rule or bug kind. Findings on live company sites stay private until Sam decides.
- Check on recorded pages runs replay only (`routeFromHAR`, `notFound: 'abort'`). Nothing reaches a live site.
- Copy in rules, docs and reports: sentence case, plain English, no em dashes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage named files only, never `git add -A`. Commit email `248309534+selfydev@users.noreply.github.com`.
- Build order before tests that import dist: format, rules, lint, then cli (`npm run build -w <pkg>`). Run `npm run typecheck` at the root before any push.
- Every new check rule: a unit test on a hand-built model, plus a `bad`/`good` browser fixture in `packages/rules/test/fixtures.ts` measured in real Chromium, plus the hard-coded rule count bumped everywhere the code map lists ("29 rules" traps), plus `UPDATE_RULES_MD=1 npm test -w @dualkit/rules` to regenerate RULES.md.
- A new rule must report the marked element or a descendant, not its block parent, or eval cannot credit it.

## Review Focus

1. A page with no Arabic, or an English page inside an Arabic site: every new rule stays silent. Each new rule's `moreGood` fixtures include an all-English page. Tests in Tasks 4 to 7.
2. Correct Arabic that looks like the bug: a date isolated LTR in Western digits, `1,000` or an English phrase with Latin commas inside Arabic text, a back arrow that already points right in RTL, an ellipsis that leaves most of a long label visible. Each is a `moreGood` fixture in its owning task.
3. The model fails: no key, HTTP 429 or 5xx after retries, a reply that is not JSON, or a finding that names an element index that does not exist. Check findings, the report and the exit code are unchanged, review is marked skipped with one stderr line, and bad findings are dropped. Tests in Tasks 9 and 10.
4. A very tall page or a URL target: the screenshot is sent as at most 4 tiles, and URL targets get `line: null`. Tests in Tasks 9 and 10.
5. The monthly cap is reached mid-run: no paid request is sent past $3.00, the run logs spend so far and marks the rest skipped. Test in Task 8.

---

### Task 1: Freeze the miss set and measure the starting line on it

The case set drifted when `bench/runs/2026-10` gained pages on 22 Oct, so baseline recall no longer reproduces. Freeze it first.

**Files:**
- Create: `packages/eval/cases/miss-set-2026-10.json`
- Modify: `packages/eval/src/misses.ts`, `packages/eval/src/cli.ts`, `packages/eval/README.md`
- Test: `packages/eval/test/misses.test.ts`

**Interfaces:**
- Produces: `loadFrozenCases(file: string): FrozenCase[]` and `type FrozenCase = { kind: BugKind; page: string /* path under bench/runs */; }`; `misses` command reads the frozen file by default and `--rebuild-cases` regenerates and rewrites it.

- [ ] **Step 1: Failing tests.** `loadFrozenCases` returns 65 entries for the committed file; `buildCases` given a frozen list uses exactly those pages in that order and never calls `basePages`; a frozen page that no longer exists throws a message naming the page.
- [ ] **Step 2: Run** `npx vitest run test/misses.test.ts` in `packages/eval`. Expected: FAIL, `loadFrozenCases` not defined.
- [ ] **Step 3: Implement.** Generate the frozen list once from today's `basePages` and round-robin (the same 65 cases the code map's rerun used, date-order 2 of 8). Store paths relative to the repo root.
- [ ] **Step 4: Run** the tests, then `npm run eval -w @dualkit/eval -- misses`. Expected: PASS, and recall output matches the code map's rerun table (check 18 of 65: tracking 8, isolation 8, date-order 2).
- [ ] **Step 5: Commit** `feat(eval): freeze the miss set`.

### Task 2: Check precision: arabic-leading and clipped-text, and cut labels

**Files:**
- Modify: `packages/rules/src/rules/type.ts`, `packages/rules/src/rules/layout.ts`, `packages/rules/src/dom/clips.ts`, `packages/rules/src/model.ts`, `packages/rules/test/fixtures.ts`, `packages/rules/src/docs.ts` (KNOWN_LIMITS line if the leading change needs one)
- Test: `packages/rules/test/rules/type.test.ts`, `packages/rules/test/rules/layout.test.ts`

**Interfaces:**
- Produces: `ClipNode` gains `visibleShare: number` (visible text width divided by full text width, 0 to 1) and `textHidden: number` (px of text box outside the clip rect, not scroll size).

Rulings for this task, from the labels: arabic-leading fires on display type and on readable 1.35 to 1.4 body text; clipped-text fires on padding below fully visible text; and an ellipsis exempts every box, so a two-word label cut to one letter is never flagged.

- [ ] **Step 1: Failing tests.**
  - `type/arabic-leading` fires on 16 px, 3 lines, line-height 1.2; is silent at 16 px, 3 lines, 1.35; silent at 24 px, 3 lines, 1.2; silent when the run's box lies wholly outside the viewport width (a hidden carousel slide).
  - `layout/clipped-text` is silent when `textHidden <= 2` even if the scroll size overflows by 10 px (padding); fires when `textHidden > 2`; fires on an ellipsis box with `visibleShare < 0.5`; silent on an ellipsis box with `visibleShare >= 0.5`.
  - Fixtures: bad for cut label is `<h1 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:3em">عنوان التوصيل</h1>`; good includes padding-only overflow and a long ellipsised sentence that shows most of itself.
- [ ] **Step 2: Run** `npm test -w @dualkit/rules -- type layout fixtures`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement.** Leading: threshold 1.3 (was 1.5), exempt font size of 20 px and above, skip runs whose box is fully outside `[0, viewport width]`. Clips: measure painted text boxes against the clip rect in `clips.ts`, fill `textHidden` and `visibleShare`, and make the rule use them.
- [ ] **Step 4: Run** the rules tests, then rebuild rules and cli and run `npm run eval -w @dualkit/eval -- all --data ~/Documents/Code/dualkit-sweep-data`. Expected: tests PASS; cut-label recall at least 7 of 8; record the two rules' precision in the task report.
- [ ] **Step 5: Commit** `fix(rules): arabic-leading and clipped-text match what readers see`.

### Task 3: Lint precision: physical-tailwind and intl-digits

**Files:**
- Modify: `packages/lint/src/rules/tailwind.ts`, `packages/lint/src/rules/intl.ts`, `packages/lint/LINT.md` (regenerated)
- Test: `packages/lint/test/rules/tailwind.test.ts`, `packages/lint/test/rules/intl.test.ts`

- [ ] **Step 1: Failing tests.**
  - physical-tailwind is silent on `<div aria-hidden="true" class="absolute left-4">`, on a child of an `aria-hidden` element, on `pointer-events-none absolute left-0` decoration, on an element with its own `dir` attribute, and on an element with an inline `style` that sets `left`; still fires on `<button class="ml-2">` with Arabic siblings.
  - intl-digits is severity `note`.
- [ ] **Step 2: Run** `npm test -w @dualkit/lint`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the skips in the tailwind rule's existing skip chain; change intl-digits severity to `note`. Regenerate with `UPDATE_LINT_MD=1 npm test -w @dualkit/lint`.
- [ ] **Step 4: Run** lint tests and the eval precision command. Expected: PASS; physical-tailwind precision recorded.
- [ ] **Step 5: Commit** `fix(lint): skip decoration and own-direction elements; intl-digits becomes a note`.

### Task 4: New rule `bidi/date-order`

**Files:**
- Modify: `packages/rules/src/model.ts` (`TextRun.forcedLtr: boolean`), `packages/rules/src/dom/` text reader, `packages/rules/src/rules/bidi.ts`, `packages/rules/src/text.ts`, `packages/rules/test/fixtures.ts`, rule-count traps
- Test: `packages/rules/test/rules/bidi.test.ts`

**Interfaces:**
- Produces: `TextRun.forcedLtr`: the run sits under an element whose `dir="ltr"` attribute or `direction: ltr` puts LTR text order on it (bdi, dir or CSS), separate from `isolated`.

Severity error. It flags exactly what the bidi algorithm reorders, and nothing it keeps whole. The conditions are in `packages/eval/src/inject-date.ts:45-60`: in RTL text, digits joined by `-` reorder when they are Arabic numbers (Arabic-Indic digits, or Western digits whose nearest strong letter before them is Arabic); a `/` joins Arabic numbers and does not reorder; a Latin letter before the date keeps it whole. Second case: a worded Arabic date (Arabic month name or ص/م) in a run with `forcedLtr`.

- [ ] **Step 1: Failing tests** (unit, on hand-built runs): fires on `١٥-٠٣-٢٠٢٥` alone in an RTL block; fires on `تاريخ 15-03-2025`; silent on `15/03/2025` and `١٥/٠٣/٢٠٢٥`; silent on `Date 15-03-2025` in RTL; silent on an isolated run (`isolated: true, forcedLtr: true`) in Western digits; fires on `15 مارس 2025، 10:00 ص` with `forcedLtr: true`; silent in an LTR block. Fixtures: bad `<div dir="rtl"><span>٣-١١-٢٠٢٦</span></div>`; moreGood includes the slash form and an English page.
- [ ] **Step 2: Run** `npm test -w @dualkit/rules -- bidi fixtures`. Expected: FAIL.
- [ ] **Step 3: Implement** a `DASH_DATE` pattern in `text.ts`, the `forcedLtr` reader field, and the rule. Verify in the fixture that Chromium really reorders the bad page (compare character x positions, as eval's date injector test does).
- [ ] **Step 4: Run** tests and eval misses. Expected: PASS; date-order at least 7 of 8, and the real miss caught.
- [ ] **Step 5: Commit** `feat(rules): bidi/date-order`.

### Task 5: New rules `content/latin-punctuation` and `content/currency-order`

**Files:**
- Modify: `packages/rules/src/rules/content.ts`, `packages/rules/src/text.ts`, `packages/rules/test/fixtures.ts`, rule-count traps
- Test: `packages/rules/test/rules/content.test.ts`

Both warnings.
- latin-punctuation: a Latin `,` `;` or `?` whose nearest non-space character before it is an Arabic letter, and whose nearest non-space character after it is an Arabic letter or the end of the run. Digits on both sides (`1,000`) and Latin words on either side are skipped.
- currency-order: in an RTL block run with Arabic, an Arabic currency abbreviation (`د.إ`, `ر.س`, `ر.ق`, `د.ك`, `د.ب`, `ر.ع`, `ج.م`) or word (`درهم`, `ريال`, `دينار`, `جنيه`) placed before its number. Latin codes (`AED 12`) and the new currency signs are left alone, because Gulf apps use both orders for them.

- [ ] **Step 1: Failing tests:** latin-punctuation fires on `مع أي شخص, بما في ذلك` and `هل أنت متأكد?`; silent on `١,٠٠٠`, `1,000 ريال`, `iPhone, iPad` inside Arabic, and `،`. currency-order fires on `د.إ 2.50` and `ريال ٣٠٠`; silent on `2.50 د.إ`, `AED 12`, and English text. Fixtures for both, with an English page in `moreGood`.
- [ ] **Step 2: Run** the content and fixture tests. Expected: FAIL.
- [ ] **Step 3: Implement** both rules over `TextRun`s, reporting the run's own node.
- [ ] **Step 4: Run** tests and eval. Expected: PASS; latin-punctuation and currency-side each at least 7 of 8.
- [ ] **Step 5: Commit** `feat(rules): latin-punctuation and currency-order`.

### Task 6: Arrow direction: read the drawn head, and new rule `icons/arrow-points-forward`

**Files:**
- Modify: `packages/rules/src/model.ts` (`IconNode.head`, `IconNode.role`), `packages/rules/src/dom/icons.ts`, `packages/rules/src/rules/icons.ts`, `packages/rules/test/fixtures.ts`, rule-count traps
- Create: `packages/rules/src/dom/arrow.ts` (port of `headDirection` from `packages/eval/src/inject-path.ts:118`)
- Test: `packages/rules/test/rules/icons.test.ts`, `packages/rules/test/dom/arrow.test.ts`

**Interfaces:**
- Produces: `IconNode.head: 'left' | 'right' | null` (the on-screen direction after transforms; null when not an arrow or not readable); `IconNode.role: 'back' | 'forward' | null` from the control's label, class, id or title (back, prev, رجوع, السابق, عودة; next, forward, التالي, متابعة). Unicode glyph arrows (← → ‹ › « ») inside a button or link become icon candidates.

Severity error. In an RTL screen, a `back` icon whose head points left, or a `forward` icon whose head points right, is wrong. Eval's `headDirection` is the reference algorithm; port it, do not import eval.

- [ ] **Step 1: Failing tests:** `headDirection` on `m 9 18 6 -6 -6 -6` returns right, on its mirror returns left, and on a non-arrow path returns null. Rule: back + head left + rtl fires; back + head right silent; forward + head right fires; role null silent; ltr silent. Fixtures: bad `<button aria-label="رجوع"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>` in RTL; bad glyph `<a aria-label="السابق">←</a>`; good the same with a CSS `scaleX(-1)` and with the right-pointing path.
- [ ] **Step 2: Run** icons tests. Expected: FAIL.
- [ ] **Step 3: Implement** the port, the reader fields, and the rule.
- [ ] **Step 4: Run** tests and eval. Expected: PASS; back-arrow at least 7 of 8.
- [ ] **Step 5: Commit** `feat(rules): read drawn arrow direction; icons/arrow-points-forward`.

### Task 7: Code fields that drop Arabic digits

**Files:**
- Modify: `packages/cli/src/audit.ts`, `packages/rules/src/model.ts` (`FieldNode.dropsArabicDigits: boolean | null`), `packages/rules/src/rules/content.ts`, `packages/rules/test/fixtures.ts`, rule-count traps
- Create: `packages/cli/src/probe.ts`
- Test: `packages/cli/test/probe.test.ts`, `packages/rules/test/rules/content.test.ts`

**Interfaces:**
- Produces: `probeArabicDigits(page: Page, fields: FieldNode[]): Promise<Map<string, boolean>>` keyed by field id. Rule `content/drops-arabic-digits` (error) reads `dropsArabicDigits === true`. The reader sets the field to `null`; only the audit probe sets true or false.

The probe runs after the read and before `runRules`, only on fields of kind `code`, `tel` or `number`, at most 8 fields. For each: `locator.fill('١٢')`, read back the value, then restore the original value. Dropped means the value contains neither `١٢` nor `12`. It never presses Enter and never submits. A field the probe cannot fill is left `null`.

- [ ] **Step 1: Failing tests:** probe on a page with the injector's `oninput` replace returns true; on a plain numeric input returns false; on an input that converts `١٢` to `12` returns false; on a disabled field leaves it out. Rule fires only on `true`.
- [ ] **Step 2: Run** `npm test -w dualkit -- probe` and the rules content test. Expected: FAIL.
- [ ] **Step 3: Implement** the probe and the rule; the rules fixture test for this rule injects `dropsArabicDigits` the way audit does (document this in the fixture).
- [ ] **Step 4: Run** tests and eval. Expected: PASS; otp-digits at least 7 of 8.
- [ ] **Step 5: Commit** `feat: check types Arabic digits into code fields`.

### Task 8: Finding fields and the vision model client

**Files:**
- Modify: `packages/rules/src/rule.ts` (`Finding` gains optional `source?: 'check' | 'review'`, `confidence?: number`, `line?: number | null`)
- Create: `packages/cli/src/review/model.ts`, `packages/cli/src/review/spend.ts`
- Test: `packages/cli/test/review/model.test.ts`, `packages/cli/test/review/spend.test.ts`

**Interfaces:**
- Produces:
  - `type VisionModel = { provider: 'openrouter' | 'gemini'; model: string }`
  - `type Ask = { system: string; text: string; images: { mime: 'image/png'; base64: string }[] }`
  - `type Answer = { ok: true; text: string; costUsd: number } | { ok: false; error: string }`
  - `makeVision({ env, fetch?, sleep?, ledger? }): (model: VisionModel, ask: Ask) => Promise<Answer>`
  - `type Ledger = { spent(): number; add(usd: number): void; capUsd: number | null }`, `fileLedger(path: string, capUsd: number | null): Ledger` (JSON `{ month, usd, calls }`, resets when the month changes)
  - `DEFAULT_REVIEW_MODEL: VisionModel = { provider: 'gemini', model: 'gemini-flash-lite-latest' }`

Port the request, retry and pacing logic from `packages/bench/src/providers.ts` (bench stays as it is). OpenRouter sends `content: [{ type: 'text' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,…' } }]` with `usage: { include: true }` and reads `usage.cost`; Gemini sends `inline_data` parts and costs 0. Temperature 0.

- [ ] **Step 1: Failing tests** with a fake fetch: image parts are sent in each provider's shape; a missing key returns `{ ok: false }` naming the variable; 429 retries then fails; `usage.cost` is added to the ledger; with `capUsd: 3` and `spent() >= 3` no request is sent and the answer is `{ ok: false, error: 'Monthly review budget spent' }`; the ledger resets on a new month.
- [ ] **Step 2: Run** `npm test -w dualkit -- review`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): vision model client with a monthly spend cap`.

### Task 9: The reviewer: features, rule choice, findings pinned to elements

**Files:**
- Create: `packages/cli/src/review/features.ts`, `packages/cli/src/review/rules.ts`, `packages/cli/src/review/prompt.ts`, `packages/cli/src/review/position.ts`, `packages/cli/src/review/tiles.ts`
- Test: `packages/cli/test/review/*.test.ts`

**Interfaces:**
- Consumes: `ScreenModel`, `AuditResult`, `makeVision` from Task 8.
- Produces:
  - `type Feature = 'dates' | 'money' | 'tables' | 'forms' | 'chat' | 'icons' | 'numbers-in-text'`
  - `detectFeatures(model: ScreenModel, tags: Record<string, number>): Feature[]` (`tags` counts `table`, `input`, `form` and similar, gathered by one `page.evaluate` in audit and added to `AuditResult.tags`)
  - `type ReviewRule = { id: string /* review/<name> */; features: Feature[]; title: string; ask: string; fix: string }`, `REVIEW_RULES: ReviewRule[]`, `pickRules(features: Feature[]): ReviewRule[]`
  - `candidates(model: ScreenModel, limit = 150): NodeRef[]` (Arabic text runs, icons and fields, deduped by id, in reading order)
  - `tiles(png: string, scale: number, maxTiles = 4): string[]` (slices of one viewport height each)
  - `findingsFrom(reply: string, cands: NodeRef[], rules: ReviewRule[]): Finding[]` (drops unknown rule ids, out-of-range element numbers and non-JSON replies)
  - `lineOf(source: string, node: NodeRef): number | null` (1-based line of the node's opening tag when exactly one source tag matches it after whitespace and attribute-order normalising, else null)

Review rules (about 8, one per thing fixed rules cannot see): dates read in the wrong order; amounts or currency read wrongly; icons whose meaning breaks when mirrored, or that should mirror and do not; Arabic that reads like a machine translation or mixes registers; truncated or overlapping Arabic; table columns in the wrong order for RTL; chat bubbles on the wrong side; form labels and errors misplaced for RTL. Each `ask` says what an Arabic reader would see as wrong, in plain words.

The prompt sends the tiles, the numbered candidate list (`[n] <snippet>` with its box), the picked rules and the check and lint findings already reported, with the instruction not to repeat them. The reply is JSON: `{ findings: [{ rule, element, message, confidence }] }`.

- [ ] **Step 1: Failing tests:** a model with a date run and money run yields `dates` and `money`; `pickRules(['dates'])` contains `review/date-reads-wrong` and not the chat rule; `tiles` on a 3-viewport page returns 3 and on a 9-viewport page returns 4; `findingsFrom` maps `element: 2` to the third candidate with `source: 'review'`, drops `element: 999` and an unknown rule, and returns `[]` on `"sorry"`; `lineOf` finds line 3 for a tag repeated once and null for a tag that appears twice.
- [ ] **Step 2: Run** `npm test -w dualkit -- review`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cli): reviewer features, rules and positioning`.

### Task 10: Reflection, and `dualkit check --review`

**Files:**
- Create: `packages/cli/src/review/reflect.ts`, `packages/cli/src/review/index.ts`
- Modify: `packages/cli/src/cli.ts` (flags `--review`, `--review-model <provider:model>`), `packages/cli/src/audit.ts` (tags), `packages/cli/src/summary.ts`, `packages/cli/src/report/*` (a "review" badge and confidence on cards), CLI HELP text
- Test: `packages/cli/test/review/reflect.test.ts`, `packages/cli/test/cli.test.ts`

**Interfaces:**
- Produces: `review(result: AuditResult, opts: { source: string | null; vision; model: VisionModel; log }): Promise<{ findings: Finding[]; spentUsd: number; skipped: string | null }>`; `reflect(f: Finding, crop: string, sourceExcerpt: string | null, vision, model): Promise<Finding | null>`.

Reflection crops the 2x screenshot to the finding's box plus 48 CSS px each side (reuse `src/report/png.ts`), sends the crop, the source excerpt and the claim, and keeps the finding only when the model confirms it with confidence of at least 0.7. The kept finding's confidence is the reflection's. Review findings are warnings, never errors, and do not change the score or the exit code in this step.

- [ ] **Step 1: Failing tests** with a fake vision: confirmed at 0.8 keeps the finding with confidence 0.8; confirmed at 0.5 drops it; a non-JSON reflection drops it; `check page.html --review` prints check findings then review findings marked `review`; with no key it prints the check result, one stderr line `Review skipped: No GEMINI_API_KEY`, and exits with the same code as without `--review`; `--json` output includes `review: { spentUsd, skipped }`; a URL target gives `line: null`.
- [ ] **Step 2: Run** `npm test -w dualkit`. Expected: FAIL.
- [ ] **Step 3: Implement**, wiring `review()` after `audit()` in the `check` branch, with the source read only for local file targets.
- [ ] **Step 4: Run** tests, build the CLI, and run `node packages/cli/dist/cli.js check <a stored bench page> --review` once with a real key. Expected: PASS, and a report with review cards.
- [ ] **Step 5: Commit** `feat(cli): dualkit check --review`.

### Task 11: Eval measures the reviewer and the combined tool

**Files:**
- Modify: `packages/eval/src/misses.ts`, `packages/eval/src/precision.ts`, `packages/eval/src/report.ts`, `packages/eval/src/cli.ts`
- Create: `packages/eval/src/review-cache.ts`
- Test: `packages/eval/test/report.test.ts`, `packages/eval/test/misses.test.ts`

**Interfaces:**
- Produces: `misses --review` and `precision --review` run the reviewer on each case or recorded page; results are cached in `packages/eval/out/review-cache/<sha256 of html + model + prompt version>.json` so a rerun costs nothing; the ledger is `packages/eval/out/spend-<YYYY-MM>.json` with `capUsd: 3`. The report gains a `review` column and a `dualkit` column, where a case counts as caught when check, lint or review catches it. Review precision uses labels in `labels/review-<name>.json` in the private data.

- [ ] **Step 1: Failing tests:** report renders the review and dualkit columns; a case caught only by review counts for dualkit; a cached result is used without calling the model; the run log ends with the spend line `Spent $0.00 of $3.00 this month`.
- [ ] **Step 2: Run** `npx vitest run` in `packages/eval`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(eval): measure the reviewer`.

### Task 12: Measure, label, rule on what is left, write it up

Controller-run, not a code task.

- [ ] **Step 1:** Rebuild everything. Run `npm run eval -w @dualkit/eval -- all --review --data ~/Documents/Code/dualkit-sweep-data` on the free default model.
- [ ] **Step 2:** Label new findings in the private data: every finding from a new or changed rule on the 10 recorded pages, up to 20 per rule, and up to 40 review findings. Add 20 of each new set to a new spot-check file `~/Documents/Code/dualkit-sweep-data/spot-check-step2.md`.
- [ ] **Step 3:** Rerun precision. Any check or lint rule still under 90% with at least 10 decided findings becomes a note, and its line goes in the report. Rules under 10 decided findings are listed as hints. If review precision is under 90%, `--review` is labelled experimental in HELP and docs.
- [ ] **Step 4:** If the free model misses the recall bar, check OpenRouter's free-request rule (Global Constraints), then run the review once with one paid vision model within the cap and report both.
- [ ] **Step 5:** Write `docs/research/2026-10-2x-v2-step2.md`: before and after per tool and per kind, on the frozen set, against each bar, with spend, in the baseline's format. Commit `docs: v2 step 2 results`.

### Task 13: Release surfaces

**Files:** package.json versions (`@dualkit/rules` 0.4.0-beta.0, `@dualkit/lint` 0.3.0-beta.0, `dualkit` 0.5.0-beta.0, with the CLI's exact pins updated), `apps/site/lib/updates.ts` (one release entry), `apps/site/app/docs/page.tsx` and `apps/site/lib/copy.ts` (`--review`, keys, cost), package READMEs and the root README (rule count, review), the org profile README Check line, `apps/site/lib/v3/testcount.ts` via `node apps/site/scripts/count-tests.mjs`.

- [ ] **Step 1:** Update each surface; the updates entry says which rules changed severity and why CI results may change.
- [ ] **Step 2:** `npm run typecheck && npm test && npm run build`. Expected: PASS.
- [ ] **Step 3: Commit** `chore: release surfaces for v2 step 2`. The controller opens the PR, merges when checks pass, checks the Vercel deploy, then publishes rules, lint, then cli through publish.yml.
