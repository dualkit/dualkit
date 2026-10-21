# Check loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third bench setup, `loop`, where a model fixes its with-skills page from `dualkit check` and `dualkit lint` findings, plus five new screens and a study report that prints the pass bars.

**Architecture:** All in `packages/bench`. Providers take follow-up turns. Scoring keeps the full check findings and lints the page. A new `loop.ts` runs up to two fix rounds from the stored `dualkit` build and records harm per round. A new `study.ts` reads a month's records and prints the three pass bars. The site summary and /bench page stay on two setups.

**Tech Stack:** TypeScript, Vitest, Playwright 1.55.0, `@dualkit/rules`, `@dualkit/lint` (workspace).

**Spec:** `docs/superpowers/specs/2026-10-21-check-loop-design.md`

## Global Constraints

- Alone and with-skills builds are made exactly as today. Only `rulesPassed` changes (Task 2) and it applies to all three setups alike.
- At most 2 fix rounds per loop build. Findings sent: severity `warning` or `error` only, from check and lint.
- Fix instruction, verbatim: `Fix these. Change only what they need. Reply with the whole file.`
- Ten screens: the five existing plus `checkout`, `support-chat`, `booking`, `settings`, `transactions`, in that order.
- Workflow job timeout 360 minutes. The run step's deadline leaves 25 minutes for builds in flight, as today.
- The summary written to `apps/site` is unchanged in shape and ignores `loop` records.
- Copy in prompts and messages: plain English, sentence case, no em dashes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage named files only.

## Review Focus

1. A fix reply with no HTML, or a page that fails to render: the round is recorded as failed and the previous page stays the loop build's page. Test in Task 4.
2. A `dualkit` build that failed or is missing: the loop build is not attempted and is not written, so a rerun tries it once the `dualkit` build exists. Test in Task 4.
3. A model that "fixes" by deleting content: the required-parts check makes it incomplete, and the round records `lostParts`. Test in Task 4.
4. A `dualkit` page with nothing at warning or error: the loop build is written with zero rounds and the same score, without a call. Test in Task 4.
5. Resume: a rerun skips loop builds already done, and does not redo the `dualkit` build. Test in Task 4.

---

### Task 1: Follow-up turns in providers

**Files:**
- Modify: `packages/bench/src/providers.ts`, `packages/bench/src/fake.ts`
- Test: `packages/bench/test/providers.test.ts`

**Interfaces:**
- Produces: `export type Turn = { role: 'user' | 'assistant'; content: string }`; `Generate = (model, req: { system: string; prompt: string; turns?: Turn[] }) => Promise<Generated>`. Turns go after the first user prompt, in order.

- [ ] **Step 1: Failing tests** in `providers.test.ts`:
  - `it('sends follow-up turns to OpenRouter in order')`: body `messages` equals `[system, user prompt, {role:'assistant', content:'A'}, {role:'user', content:'B'}]`.
  - `it('sends follow-up turns to Gemini with the model role')`: body `contents` equals `[{role:'user',parts:[{text:prompt}]}, {role:'model',parts:[{text:'A'}]}, {role:'user',parts:[{text:'B'}]}]`.
  - `it('sends no extra turns when none are given')`: bodies unchanged from today.
- [ ] **Step 2:** `npx vitest run packages/bench/test/providers.test.ts`: the new tests fail.
- [ ] **Step 3:** Map `turns` in `request()`. In `fakeGenerate`, any request with `turns` returns the `good` fixture fenced, for every fake model except `fake-garbage`, which keeps replying with no HTML.
- [ ] **Step 4:** Same command: PASS.
- [ ] **Step 5:** Commit `feat: bench providers take follow-up turns`.

### Task 2: Scoring keeps what a fix needs

**Files:**
- Modify: `packages/bench/src/score.ts`, `packages/bench/package.json` (add `"@dualkit/lint": "*"`)
- Create: `packages/bench/src/feedback.ts`
- Test: `packages/bench/test/score.test.ts`, `packages/bench/test/feedback.test.ts`

**Interfaces:**
- Produces in `score.ts`:
  - `SlimFinding` gains `message: string; fix: string; snippet: string | null`.
  - `Scored` ok branch gains `text: string`: the page's visible text plus field values, already normalised (what `pageText` returns).
  - `rulesPassed = RULE_COUNT - (distinct rules with a warning or error finding)`. Notes no longer count against it. Ruling recorded in the spec's spirit: the loop never sends notes, and check's own score ignores them, so the headline must too. No month has been published, so nothing past changes.
- Produces in `feedback.ts`:
  - `lintPage(html: string): LintFinding[]`: `lintText('index.html', html)` from `@dualkit/lint`, warnings and errors only.
  - `feedbackPrompt(check: SlimFinding[], lint: LintFinding[]): string | null`: `null` when no finding is at warning or error. Otherwise:

```
dualkit check and dualkit lint found these problems in your page.

1. [check] <title> (<rule>): <message> Element: `<snippet clipped to 160 chars>`. How to fix: <fix>
2. [lint] <title> (<rule>), line <line>: <message> How to fix: <fix>

Fix these. Change only what they need. Reply with the whole file.
```

  Check findings first in page order, then lint by line. At most 40 items; past that one line `…and N more.` before the instruction.

- [ ] **Step 1: Failing tests:**
  - score: `it('counts only rules with a warning or error as failed')` on a page whose only finding is a note: `rulesPassed === RULE_COUNT`.
  - score: `it('keeps message, fix, snippet and page text')`.
  - feedback: `it('returns null when only notes are left')`; `it('numbers check before lint and ends with the instruction')` (exact string); `it('caps at 40 and says how many more')`; `it('lints a style block in the page')` (`margin-left: 8px` in `<style>` gives `source/physical-css`).
- [ ] **Step 2:** `npx vitest run packages/bench/test/score.test.ts packages/bench/test/feedback.test.ts`: fail.
- [ ] **Step 3:** Implement. Run `npm install` at the root so the workspace link exists.
- [ ] **Step 4:** Same command, then the whole bench suite `npx vitest run packages/bench`: PASS (fix existing expectations that relied on notes counting, and say which in the report).
- [ ] **Step 5:** Commit `feat: bench scoring keeps findings a fix can use`.

### Task 3: Five new screens

**Files:**
- Create: `packages/bench/prompts/{checkout,support-chat,booking,settings,transactions}.{md,json}`
- Modify: `packages/bench/src/config.ts` (`SCREENS`)
- Test: `packages/bench/test/config.test.ts`

Prompt text, verbatim, each followed by the same closing paragraph as today's prompts (`Write the Arabic text yourself. Reply with one complete, self-contained HTML file in a single html code block.`):

- `checkout` (title `Checkout`): `Build the checkout screen of an Emirati grocery app, in Arabic, for a phone.` / `It shows three items in the cart, each with a photo placeholder, a name, a quantity stepper and a price in AED. Below them: a promo code field, the subtotal, delivery, VAT at 5% and the total, and a "Place order" button. A back arrow sits at the top.`
  Required: `quantity steppers` selector `button, [role=button], input[type=number]` min 6; `AED prices` text `(AED|د\.إ|درهم)`; `promo field` selector `input`; `place order button` selector `button, [role=button], input[type=submit]`.
- `support-chat` (title `Support chat`): `Build the support chat screen of a Kuwaiti telecom app, in Arabic, for a phone.` / `It shows a conversation of six messages between the customer and an agent named Sara. Some messages mix Arabic with English words such as "5G", "eSIM" and an order number like TX-48213. Each message shows its time. At the bottom: a text field and a send button.`
  Required: `order number` text `TX-?48213`; `English terms` text `eSIM`; `message field` selector `input, textarea, [contenteditable=true]`; `send button` selector `button, [role=button]`.
- `booking` (title `Booking`): `Build the appointment booking screen of a Qatari clinic app, in Arabic, for a phone.` / `It shows a month calendar with the week starting on Saturday, today marked, a row of time slots from 9:00 to 12:00 every 30 minutes, the doctor's name and a "Confirm booking" button. Next and previous month arrows sit beside the month name.`
  Required: `calendar days` text `(?<![0-9])2[0-9](?![0-9])[\s\S]*(?<![0-9])3[01](?![0-9])|(?<![٠-٩])٢[٠-٩](?![٠-٩])[\s\S]*(?<![٠-٩])٣[٠١](?![٠-٩])`; `time slots` text `(9|٩)[:٫]?(00|٠٠)[\s\S]*(1|١)(1|١)[:٫]?(30|٣٠)`; `confirm button` selector `button, [role=button], input[type=submit]`.
- `settings` (title `Settings`): `Build the settings screen of a Bahraini banking app, in Arabic, for a phone.` / `It has three groups: account (name, phone +973 3600 1234, language), security (Face ID and two-step login, each with a toggle) and notifications (transfers, offers and statements, each with a toggle). Rows that open another screen show a chevron.`
  Required: `toggles` selector `input[type=checkbox], [role=switch]` min 5; `phone number` text `973`.
- `transactions` (title `Transactions`): `Build the transactions screen of an Omani wallet app, in Arabic, for a phone.` / `It shows a table of eight transactions with the date, the merchant (some names in English, such as "Lulu Hypermarket" and "Netflix"), the amount in OMR with three decimals, and whether money came in or went out. Above the table: the balance and a filter for this month.`
  Required: `eight rows` selector `tr, [role=row]` min 8; `OMR amounts` text `(OMR|ر\.ع|ريال)`; `three decimals` text `\d[.٫]\d{3}(?!\d)|[٠-٩][.٫][٠-٩]{3}(?![٠-٩])`; `English merchant` text `Netflix`.

- [ ] **Step 1: Failing test** `it('loads ten screens in order')`: `loadScreens().map(s => s.id)` equals the ten ids in Global Constraints.
- [ ] **Step 2:** `npx vitest run packages/bench/test/config.test.ts`: fail.
- [ ] **Step 3:** Write the files and extend `SCREENS`.
- [ ] **Step 4:** Same command, plus `it.each` over the five new screens: each required pattern is a valid `RegExp` and matches a hand-written good Arabic sample in the test (one line per part). PASS.
- [ ] **Step 5:** Commit `feat: five more bench screens`.

### Task 4: The loop setup

**Files:**
- Create: `packages/bench/src/loop.ts`
- Modify: `packages/bench/src/store.ts`, `packages/bench/src/run.ts`, `packages/bench/src/progress.ts`
- Test: `packages/bench/test/loop.test.ts`, `packages/bench/test/run.test.ts`, `packages/bench/test/store.test.ts`

**Interfaces:**
- Consumes: `Turn` (Task 1); `feedbackPrompt`, `lintPage`, `Scored.text`, full `SlimFinding` (Task 2).
- Produces:
  - `Condition = 'alone' | 'dualkit' | 'loop'`; store file pattern accepts `loop-<n>.json`.
  - `MAX_ROUNDS = 2` in `loop.ts`.
  - `type Round = { at: string; ms: number; usage: Usage | null; reply: string | null; ok: boolean; error: string | null; sent: number; rulesPassed: number | null; score: number | null; missing: string[]; regressed: string[]; lostParts: string[]; arabicKept: number | null }`. `sent` is how many findings the prompt listed.
  - Loop `BuildRecord` = the usual ok record for the final page, plus `from: { rulesPassed: number; score: number }` (the `dualkit` build's) and `rounds: Round[]`.
  - `harm(before: { failed: string[]; missing: string[]; text: string }, after: same): { regressed: string[]; lostParts: string[]; arabicKept: number }`. `regressed` = rules failed after and not before. `lostParts` = parts missing after and not before. `arabicKept` = for Arabic letters U+0621 to U+064A, the multiset overlap of before and after divided by the count before, rounded to 3 places; 1 when before has none.
- Flow per (model, screen, run), after the `dualkit` build of that run: if `loop-<run>` is done, skip. If the `dualkit` record is not ok or its HTML file is missing, skip without writing. Otherwise loop: build `feedbackPrompt(dualkit findings, lintPage(html))`; if null, stop. Call `generate` with `turns: [{assistant: dualkit reply}, {user: feedback}]` and, in round 2, the round 1 reply and its feedback appended. A round's page that has no HTML or fails to render is a failed round; the next round (if any) starts from the last good page with the turns of the last good round. The record's score fields come from the last good page. Write `loop-<run>.html` and `.webp` for that page.
- `progress.ts` `RecentBuild.condition` accepts `'loop'`. The total counts loop builds.

- [ ] **Step 1: Failing tests:**
  - `harm`: regressed and lostParts as defined; `arabicKept` 0.5 when half the letters go; 1 for no Arabic before.
  - `loop.test.ts` with a stub `generate` and stub scorer: the five Review Focus cases; `it('stops after two rounds')`; `it('sends the dualkit reply and the feedback as turns')`; `it('keeps the last good page when round 2 fails')`.
  - `run.test.ts`: `it('runs loop after dualkit for the same run')` (order of generate calls per model: alone 1..3, dualkit 1, loop 1, dualkit 2, loop 2, … is fine; assert each loop call comes after its dualkit build); `it('skips done loop builds on rerun')`.
  - `store.test.ts`: `list()` returns loop records.
- [ ] **Step 2:** `npx vitest run packages/bench`: new tests fail.
- [ ] **Step 3:** Implement. Keep `build()` in `run.ts` for alone and dualkit; `runModel` calls `loopBuild` from `loop.ts` right after each `dualkit` build (or skip). Loop failures count toward the error streak like any build.
- [ ] **Step 4:** `npx vitest run packages/bench` and `npm run typecheck` at the root: PASS.
- [ ] **Step 5:** End-to-end dry run: `npm run bench -- --fake --no-summary --month 2026-09` (or the script name in `packages/bench/package.json`), then check `bench/runs/2026-09/fake-buggy/otp/loop-1.json` has `rounds.length` 0 (its dualkit page is the good fixture) and `fake-garbage` has no loop file. Delete `bench/runs/2026-09` afterwards.
- [ ] **Step 6:** Commit `feat: bench loop setup fixes from check and lint`.

### Task 5: Study report and workflow

**Files:**
- Create: `packages/bench/src/study.ts`
- Modify: `packages/bench/src/cli.ts`, `packages/bench/src/args.ts`, `packages/bench/src/summary.ts` (filter to `alone` and `dualkit`), `.github/workflows/bench.yml`
- Test: `packages/bench/test/study.test.ts`, `packages/bench/test/args.test.ts`, `packages/bench/test/workflow.test.ts`, `packages/bench/test/summary.test.ts`

**Interfaces:**
- `study(records: BuildRecord[], models: ModelEntry[], screens: Screen[]): Study` where per model: `failed` = sum over screens of (RULE_COUNT - cell median rulesPassed) for `alone`, `dualkit` and `loop` (incomplete counts as all failed, as `effective` does), `null` when any cell did not run; `halved = loop.failed <= alone.failed / 2`. Totals: `modelsHalved`, `rounds`, `harmfulRounds` (regressed or lostParts non-empty), `harmRate`, `incomplete.dualkit`, `incomplete.loop` (count of ok builds with missing parts). `pass = { gain: modelsHalved >= 4, harm: harmRate <= 0.1, honest: incomplete.loop <= incomplete.dualkit }`.
- `renderStudy(s: Study): string`: a Markdown table (model, failed alone, with skills, with loop, halved) then the three bars with pass or fail, ready to paste into the study report.
- CLI: `--study` prints `renderStudy` for `--month` and exits 0, with no generation and no summary.
- Workflow: `timeout-minutes: 360`; the run step's own timeout and `DEADLINE_MS` move up by the same 180 minutes (run step 345, `DEADLINE_MS = 320 * 60_000`). A `workflow_dispatch` boolean input `summary` (default true); when false the run passes `--no-summary` and the commit step adds only `bench/`.

- [ ] **Step 1: Failing tests:** study numbers on a hand-built set of records (one model halved, one not, one with a missing cell); harm rate counts only rounds that ran; `renderStudy` snapshot; args accepts `--study`; workflow test asserts 360, 345, the `summary` input and that `--no-summary` is wired; summary ignores loop records.
- [ ] **Step 2:** `npx vitest run packages/bench`: fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run packages/bench`, root `npm run typecheck`, `npm run lint` if present: PASS. `npm run bench -- --fake --month 2026-09 --no-summary` then `--study --fake --month 2026-09` prints a table; delete `bench/runs/2026-09`.
- [ ] **Step 5:** Commit `feat: bench study report and longer monthly run`.

#### Task 5 addition (ruling, 21 Oct): daily request budget

The old test "keeps a whole month of OpenRouter calls, every retry spent, under the 1,000 a day cap" cannot hold with ten screens and the loop (worst case 2,400). Replace it with a runtime budget:

- `makeGenerate` takes `budget?: number` (default `OPENROUTER_DAILY_BUDGET = 950`), counting every OpenRouter attempt, retries included, in this process. Once spent, a call returns `{ ok: false, error: 'Daily request budget spent', ms: 0 }` without a request.
- `runBench` treats that error like the deadline: no new build starts for any OpenRouter model, nothing is written for the build that hit it, and the counts say `stoppedEarly`. The cron on the 2nd and 3rd finishes the rest.
- Tests: the old cap test is replaced by `it('stops at the daily budget without a request')` and a run test `it('leaves builds for the next day once the budget is spent')`.
