# Dualkit v2 step 1: measure first. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private `@dualkit/eval` package that measures how often check and lint are right (precision) and how many known Arabic bugs they find (recall), so the v2 baseline is on record before any v2 code ships.

**Architecture:** Two sets, one report. The precision set reruns today's lint on the 10 pinned repos and today's check on the 10 recorded pages, then matches findings to the hand labels in the private sweep data folder (a TypeScript port of its `score.py`). The miss set takes October Bench pages that check passes cleanly, adds one known bug per case with a scripted edit that marks the bugged element `data-eval-bug`, and counts a case as caught when a tool reports a new warning or error on that element. The report prints precision, recall and F1 per tool and per rule or bug kind.

**Tech Stack:** TypeScript, tsx, vitest 3, Playwright 1.55.0 (through `@dualkit/bench`'s `scoreHtml`), `@dualkit/lint`'s `lintText`.

**Spec:** `docs/superpowers/specs/2026-10-22-dualkit-v2-design.md` (Part 1, and "Calls from the builder check").

## Global Constraints

- Package `packages/eval`, name `@dualkit/eval`, `"private": true`, never published. Layout, tsconfig and vitest config copied from `packages/bench`.
- Precision is real divided by (real + handled + intended). Unclear is left out and reported. Labels are `real`, `handled`, `intended`, `unclear`.
- Precision counts findings at warning or error. Notes are reported on their own line and do not count.
- A real bug: something an Arabic reader would see as wrong, the 20 Oct sweep test.
- The miss set has at least 60 cases. The 8 bug kinds are: garbled date order, back arrow pointing the wrong way, OTP field that drops Arabic-Indic digits, currency on the wrong side, cut-off Arabic label, Latin punctuation in Arabic text, letter-spacing on Arabic, number not isolated in a sentence. Plus every real miss found by eye.
- Miss-set base pages: `bench/runs/2026-10/**/*.html` final pages whose stored record is `ok`, has `missing: []`, and has no warning or error finding.
- The sweep data lives at `~/Documents/Code/dualkit-sweep-data`, outside the repo, passed as `--data <dir>` or `DUALKIT_SWEEP_DATA`. Nothing from it is committed: no labels, no site names, no snippets. Committed output is aggregates per tool and per rule or bug kind only. Findings on live company sites stay private until Sam decides.
- Check on recorded pages runs replay only (`routeFromHAR`, `notFound: 'abort'`), as `run-check.mjs` does. Nothing reaches a live site.
- Copy in the report and docs: sentence case, plain English, no em dashes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage named files only, never `git add -A`. Commit email is `248309534+selfydev@users.noreply.github.com`.
- Run tests from `packages/eval` (`npx vitest run`), not the repo root. Rerun the root `npm run typecheck` before any push.

## Review Focus

1. A sweep data folder that is missing or partial (a repo clone gone, a label file without its sample file): eval names what is missing and skips that product, and the report shows the product count it used. Test in Task 2.
2. An injector that finds nothing to change on a page (no date, no OTP field): it returns `null` and the case builder moves to the next page, never a no-op case that would count as a miss. Test in Task 3.
3. An injected edit that changes nothing visible: every case must render differently from its clean page (screenshot bytes differ), or it is dropped and logged. Test in Task 4.
4. A tool finding that only matches the marker because the marker sits on a wrapper: caught requires the finding's snippet (check) or line (lint) to contain `data-eval-bug`, and the clean page must not have the same rule on the same element. Test in Task 4.
5. A label id with no matching finding key because a snippet or line moved: counted as lost, listed by id in the private output, never silently dropped. Test in Task 2.

---

### Task 1: Package and shared types

**Files:**
- Create: `packages/eval/package.json`, `packages/eval/tsconfig.json`, `packages/eval/vitest.config.ts`, `packages/eval/src/types.ts`, `packages/eval/src/metrics.ts`
- Test: `packages/eval/test/metrics.test.ts`

**Interfaces:**
- Produces:
  - `type Label = 'real' | 'handled' | 'intended' | 'unclear'`
  - `type Tally = { real: number; handled: number; intended: number; unclear: number }` (counts of labelled findings the tool still reports)
  - `precision(t: Tally): number | null` (null when the denominator is 0)
  - `recall(caught: number, total: number): number | null`
  - `f1(p: number | null, r: number | null): number | null`
  - `type CaseResult = { id: string; kind: string; tool: 'check' | 'lint'; caught: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
expect(precision({ real: 8, handled: 1, intended: 1, unclear: 5 })).toBe(0.8)
expect(precision({ real: 0, handled: 0, intended: 0, unclear: 3 })).toBeNull()
expect(recall(54, 60)).toBe(0.9)
expect(recall(0, 0)).toBeNull()
expect(f1(0.8, 0.9)).toBeCloseTo(0.8471, 4)
expect(f1(null, 0.9)).toBeNull()
```

- [ ] **Step 2: Run `npx vitest run test/metrics.test.ts` from `packages/eval`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** `package.json`: scripts `eval` (`tsx src/cli.ts`), `test`, `typecheck`; dependencies `@dualkit/bench`, `@dualkit/lint`, `@dualkit/rules` at `"*"`, `playwright` `1.55.0`; dev dependencies as bench. Run `npm install` at the root so the workspace links.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(eval): package and metrics`.

### Task 2: Precision set

**Files:**
- Create: `packages/eval/src/precision.ts`, `packages/eval/test/fixtures/sweep/` (a tiny fake data folder: one lint product, one check page, made-up names and findings)
- Test: `packages/eval/test/precision.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `type SweepProduct = { tool: 'check' | 'lint'; name: string }`
  - `listProducts(data: string): { products: SweepProduct[]; skipped: { name: string; why: string }[] }`
  - `scoreRun(data: string, product: SweepProduct, findings: RunFinding[]): ProductScore`
    - `RunFinding = { rule: string; severity: string; file?: string; line?: number; snippet?: string | null }`
    - `ProductScore = { byRule: Record<string, Tally>; notes: number; lost: string[]; findings: number; unlabelled: number }`
  - `runLint(data: string, name: string): Promise<RunFinding[]>` (calls `lint(['.'], { cwd: <data>/repos/<name> })`)
  - `runCheck(data: string, name: string): Promise<RunFinding[]>` (replays `<data>/har/<name>.har.zip` for the url in `sites.txt`, 1280 by 800, with the built CLI's `audit`, as `run-check.mjs` does)

Matching is `score.py`'s, ported: lint keys are rule plus file plus line from `samples/<name>.md` headings `### <id> <rule> <file>:<line>`. Check keys are rule plus the first 100 characters of the `snippet:` line in `csamples/<name>.md`. Labels come from `labels/<name>.json` (lint) and `labels/check-<name>.json` (check). Only kept labels at warning or error go into `byRule`. Kept labels on notes add to `notes`.

- [ ] **Step 1: Write the failing tests**
  - `scores kept labels by rule and leaves out notes`: fixture with 3 real, 1 handled, 1 unclear, and 1 real on a note. `byRule` tallies `{ real: 3, handled: 1, intended: 0, unclear: 1 }`; `notes` is 1.
  - `counts a labelled finding that no longer appears as lost, by id`: remove one finding; `lost` equals `['fx#2']`.
  - `skips a product with a label file but no sample file, and says why`: `skipped` holds `{ name, why: /sample/ }`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `precision.ts`.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Check the port against `score.py` on the real data.** Run lint with today's CLI into a scratch folder, then compare `python3 <data>/score.py lint <dir>` with `scoreRun` over the same files. Expected: the same real kept, real lost and false kept totals. Record both lines in the task report.
- [ ] **Step 6: Commit** `feat(eval): precision set from the sweep labels`.

### Task 3: Bug injectors

**Files:**
- Create: `packages/eval/src/inject.ts`
- Test: `packages/eval/test/inject.test.ts`, small HTML fixtures in `packages/eval/test/fixtures/pages/`

**Interfaces:**
- Produces:
  - `type BugKind = 'date-order' | 'back-arrow' | 'otp-digits' | 'currency-side' | 'cut-label' | 'latin-punctuation' | 'arabic-tracking' | 'number-isolation'`
  - `type Injector = { kind: BugKind; inject(html: string): string | null }`
  - `INJECTORS: readonly Injector[]` (one per kind, in the order above)

Each injector works on the HTML string with `node-html-parser` (add it as a dependency), changes the first element that fits, adds `data-eval-bug="<kind>"` to the element it changed, and returns `null` when nothing fits. What each does:

| Kind | Fits | Edit |
|---|---|---|
| date-order | text with a date (digits and `/`, `-` or `.` separators, Western or Arabic-Indic) | removes any `bdi` or `dir` isolating it and writes the date with Western digits and `-` inside the Arabic sentence, so the parts reorder |
| back-arrow | a back or previous control (aria-label, text or class with back, previous, رجوع, السابق) holding an arrow or chevron | swaps the glyph or SVG for the one pointing the other way |
| otp-digits | an input with `autocomplete="one-time-code"`, `inputmode="numeric"` or a code-box group | adds `pattern="[0-9]*"` and an `oninput` that strips anything not `0-9` |
| currency-side | an amount with a currency code or sign | moves the currency to the other side of the number |
| cut-label | a short Arabic label | sets `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 3em` |
| latin-punctuation | Arabic text with `،` `؛` or `؟` | swaps them for `,` `;` `?` |
| arabic-tracking | an Arabic text element | adds `letter-spacing: 0.08em` |
| number-isolation | a number inside an Arabic sentence that is isolated | removes the isolation (`bdi`, `dir`, `unicode-bidi`) |

- [ ] **Step 1: Write the failing tests.** For each kind, one fixture where it fits: the output differs from the input and contains exactly one `data-eval-bug="<kind>"`. One fixture where it does not fit: `inject` returns `null`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `inject.ts`.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(eval): scripted Arabic bug injectors`.

### Task 4: Miss set and recall

**Files:**
- Create: `packages/eval/src/misses.ts`, `packages/eval/cases/real.json`, `packages/eval/cases/real/` (bugged pages for real misses)
- Test: `packages/eval/test/misses.test.ts`

**Interfaces:**
- Consumes: `INJECTORS` (Task 3); `scoreHtml` from `@dualkit/bench/src/score`; `lintText` from `@dualkit/lint`; `CaseResult` (Task 1).
- Produces:
  - `type MissCase = { id: string; kind: BugKind | 'real'; base: string; html: string }` (`base` is the clean page path relative to the repo root)
  - `basePages(runs: string): string[]` (sorted paths of clean October pages, by the Global Constraints rule)
  - `buildCases(pages: string[], perKind: number): { cases: MissCase[]; dropped: { id: string; why: string }[] }`
  - `runCase(c: MissCase, clean: string): Promise<CaseResult[]>` (one result per tool)

Rules:
- `perKind` is 8, so 8 kinds give 64 cases. Pages are taken in sorted order, and each page gives at most one case per kind. A kind with fewer than 8 fitting pages is reported in `dropped`.
- A case is dropped when its rendered screenshot equals the clean page's.
- Check caught: a warning or error on the bugged page whose snippet contains `data-eval-bug`, and whose rule is not reported on the same element of the clean page.
- Lint caught: a warning or error from `lintText('page.html', html)` on a line that contains `data-eval-bug`, and that is not on the clean page.
- Real misses: `cases/real.json` lists `{ id, base, bugged, selector }`. The case builder adds the marker to `selector` in the bugged page. The first entry is the garbled date in the Gemini Flash Lite booking page from the loop study (`bench/runs/2026-10/gemini-flash-lite/booking/loop-1-r1.html`, clean `dualkit-1.html`). The implementer finds the date element's selector by rendering it.

- [ ] **Step 1: Write the failing tests**
  - `takes only clean, complete pages`: a temp runs folder with one clean record, one with a warning, one with `missing: ['x']`. Only the clean one is returned.
  - `builds at most one case per kind per page and reports short kinds`: with 2 pages and `perKind` 3, every kind gets at most 2 cases and appears in `dropped` with `/fewer than 3/`.
  - `drops a case that renders the same as its clean page`.
  - `counts a check finding as caught only on the marked element`: fixture where letter-spacing is added on a marked element (caught) and a second fixture where the only new finding is on an unmarked sibling (not caught).
  - `counts a lint finding as caught only on the marked line`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `misses.ts` and `cases/real.json`.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(eval): miss set and recall`.

### Task 5: CLI, report and baseline

**Files:**
- Create: `packages/eval/src/cli.ts`, `packages/eval/src/report.ts`, `packages/eval/README.md`, `docs/research/2026-10-22-v2-baseline.md`
- Modify: `.gitignore` (add `packages/eval/out/`)
- Test: `packages/eval/test/report.test.ts`, `packages/eval/test/cli.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 4.
- Produces:
  - `npm run eval -w @dualkit/eval -- precision --data <dir>`, `-- misses`, `-- all --data <dir>`
  - `renderReport(r: EvalResult): string` (markdown)
  - `EvalResult = { at: string; precision: { tool: 'check' | 'lint'; byRule: Record<string, Tally>; notes: number; products: number; skipped: number }[]; misses: { cases: number; dropped: number; results: CaseResult[] } }`
  - Output: `packages/eval/out/<YYYY-MM-DD>.json` (gitignored, may hold names) and the markdown on stdout (aggregates only).

The markdown has three tables: per tool (precision, recall, F1, finding count), precision per rule, and recall per bug kind per tool. Rows with no data show "no data", never 0%. The header line states products used, cases run and cases dropped.

- [ ] **Step 1: Write the failing tests**
  - `renders per tool, per rule and per kind tables`, with values from a fixed `EvalResult`.
  - `shows no data rather than 0% when a row has nothing to count`.
  - `puts no product names or snippets in the markdown`: fixture names `secretco` and snippet `<p class="x">` are absent from the output.
  - `reads --data, then DUALKIT_SWEEP_DATA, and fails with a clear message when neither is set for precision`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement `cli.ts` and `report.ts`.** README: one short page on what it measures and how to run it, saying the data folder is private.
- [ ] **Step 4: Run the package tests and the root `npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Run the real baseline.** Build `@dualkit/rules`, `@dualkit/lint` and the CLI, then `npm run eval -w @dualkit/eval -- all --data ~/Documents/Code/dualkit-sweep-data`. Expected: precision for check close to 80% and lint close to 34% (the 21 Oct figures). A gap over 5 points means the port or the run is wrong: find out before writing the baseline.
- [ ] **Step 6: Spot-check file for Sam.** Write 20 random labels per set (seed 22) to `<data>/spot-check-2026-10-22.md` with each finding's crop or source line and its label. It stays in the private folder.
- [ ] **Step 7: Write `docs/research/2026-10-22-v2-baseline.md`** from the markdown: the three tables, the pass bars from the spec next to today's numbers, and what was dropped and why. Sam's copy rules.
- [ ] **Step 8: Commit** `feat(eval): CLI, report and the v2 baseline`.
