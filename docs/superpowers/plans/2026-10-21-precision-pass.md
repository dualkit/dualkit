# Precision pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut false findings in `dualkit lint` and `dualkit check` to at most 20% on the 20-product sweep while keeping at least 90% of the real bugs it found, and let lint read Vue, Svelte and CSS-in-JS.

**Architecture:** Lint gains a per-file "physical rules stay quiet" context (generated, side, email and build-flipped files), element-level deliberate-geometry skips, a repo-level right-to-left signal that collapses findings in repos with no RTL support, and two new source kinds (single-file components and tagged CSS templates). Check's DOM reader stops counting RTL-scoped and inline physical declarations and elements nobody can see, and its text-align and tracking rules judge the rendered result.

**Tech Stack:** TypeScript, vitest, @babel/parser 7, postcss + postcss-scss, parse5 7, Playwright (check tests).

**Spec:** docs/superpowers/specs/2026-10-21-precision-pass-design.md (evidence: docs/research/2026-10-20-usefulness-sweep.md)

## Global Constraints

- Packages stay CommonJS-compatible and run on Node >= 18.18. @babel/parser stays on ^7.
- No new runtime dependencies unless a task names one.
- Every user-facing string (messages, docs, README, site copy) is sentence case, plain English, no em dashes.
- Tests are vitest. Lint tests live in packages/lint/test, check rule tests in packages/rules/test.
- Shell output is condensed. Every verification command ends with `; echo EXIT=$?` and the exit code is the evidence. Before reporting DONE run the root `npm run typecheck; echo EXIT=$?` and the package tests.
- Commit messages: `<type>: <description>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage named files only, never `git add -A`.
- Rule ids already published stay valid in `ignore` configs.

## Review Focus

1. A real monorepo where the flipper is declared only in the repo-top Gemfile or package.json (Discourse): physical-css is quiet for every stylesheet below it, but physical-tailwind is not.
2. A CSS template literal whose `${}` sits in a property-name position, a value position, and a whole-declaration position: it parses, and every finding's line and column point at the real source.
3. A `.vue` file with `<style lang="scss" scoped>` and `<script setup lang="ts">`: both are read with the right parser, and a parse failure in one block skips the file with a reason instead of crashing.
4. An off-canvas menu (translated fully off the right edge) and an inactive carousel slide inside an `overflow: hidden` track: check reports nothing for either.
5. Large repos stay fast: lint on a 30,000-file repo is no more than 1.5x slower than before (Twenty took 12 s).

---

### Task 1: Lint file scope, flippers and the dir-attribute default

**Files:**
- Create: `packages/lint/src/scope.ts`
- Modify: `packages/lint/src/types.ts`, `packages/lint/src/run.ts`, `packages/lint/src/rules/css.ts`, `packages/lint/src/rules/tailwind.ts`, `packages/lint/src/rules/index.ts`, `packages/cli/src/lint.ts`
- Test: `packages/lint/test/scope.test.ts`, `packages/lint/test/run.test.ts`

**Interfaces:**
- Produces: `type QuietReason = 'generated' | 'example' | 'email' | 'flipped'`; `LintContext.physicalQuiet?: (file: SourceFile) => QuietReason | null`; `LintResult.quiet: { reason: QuietReason; files: number; flipper?: string }[]`; `export const DEFAULT_RULES: readonly LintRule[]` (RULES minus dir-attribute-selector); `RULES` keeps every rule.
- `scope.ts`: `quietReason(path: string, text: string): 'generated' | 'example' | 'email' | null` and `createFlipperLookup(top: string): (abs: string) => string | null` (returns the flipper package name, such as `rtlcss`).

- [ ] **Step 1: Write the failing tests**

`scope.test.ts`:
- `quietReason('a/b.css', '/*! tailwindcss v3.4.1 | MIT */\n.a{}')` is `'generated'`; same for `// @generated` and `/* DO NOT EDIT */` in the first 5 lines; a `DO NOT EDIT` on line 6 is `null`.
- `quietReason` is `'example'` for `examples/x.css`, `packages/demo/a.tsx`, `src/__fixtures__/a.css`, `stories/a.tsx`, `storybook-static/a.css`; `null` for `src/exampleCard.tsx` (segment match only).
- `quietReason` is `'email'` for `app/views/mailer/a.scss`, `emails/welcome.html`, `lib/mail/x.css`; `null` for `src/mailbox/a.css`.
- `createFlipperLookup` on a temp tree: `top/package.json` with devDependency `rtlcss` gives `'rtlcss'` for `top/app/a.scss`; a nested `top/pkg/package.json` without it still gives `'rtlcss'` (any ancestor up to top); a `Gemfile` at top with `gem "rtlcss"` gives `'rtlcss'`; `postcss-rtlcss`, `postcss-rtl`, `cssjanus`, `stylis-plugin-rtl`, `@mui/stylis-plugin-rtl` are each found; a tree with none gives `null`; a package.json above `top` is never read.

`run.test.ts` additions:
- `lint()` over a temp repo with `rtlcss` and a `.scss` file holding `margin-left: 4px` and a `.tsx` file with `className="ml-2"` (tailwind 3.4 installed in the fixture): no physical-css finding, one physical-tailwind finding, and `result.quiet` contains `{ reason: 'flipped', files: 1, flipper: 'rtlcss' }`.
- `lint()` with an `examples/a.css` holding `margin-left: 4px` gives no finding and `quiet` has `{ reason: 'example', files: 1 }`.
- `lint()` on `a.scss` holding `[dir="rtl"] .x { margin-right: 0 }` reports no `source/dir-attribute-selector` finding by default; `lint(..., { rules: RULES })` still does.
- `lintText` with no ctx behaves as before (no quiet).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/lint/test/scope.test.ts packages/lint/test/run.test.ts; echo EXIT=$?`
Expected: FAIL, scope module missing.

- [ ] **Step 3: Implement**

`scope.ts` with the signatures above. Flipper lookup reads each ancestor `package.json` (dependencies, devDependencies, peerDependencies) from the file's directory up to `top`, plus `Gemfile` and `*.gemspec` at `top`, caching per directory. In `lint()`: compute `top` (the existing repo-top logic used for .gitignore, else cwd), set `ctx.physicalQuiet` as `quietReason(...) ?? (flipper && css/scss file ? 'flipped' : null)`, tally `quiet`. physical-css returns `[]` for a quiet file; physical-tailwind returns `[]` only for generated, example and email (not flipped). `activeRules` defaults to `DEFAULT_RULES`. CLI human output adds one line per quiet reason, for example `Skipped physical rules in 2,249 files flipped by rtlcss.` / `... in 12 example files.` / `... in 3 generated files.` / `... in 5 email templates.`

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/lint packages/cli; echo EXIT=$?`
Expected: PASS, EXIT=0.

- [ ] **Step 5: Commit**

`git add` the named files; `git commit -m "feat(lint): quiet physical rules in generated, example, email and flipped files"`.

---

### Task 2: Deliberate geometry and the no-RTL-support collapse

**Files:**
- Modify: `packages/lint/src/classes.ts`, `packages/lint/src/rules/tailwind.ts`, `packages/lint/src/run.ts`, `packages/lint/src/rules/index.ts`, `packages/lint/src/docs.ts`, `packages/lint/LINT.md`
- Create: `packages/lint/src/rtl-signal.ts`
- Test: `packages/lint/test/classes.test.ts`, `packages/lint/test/rtl-signal.test.ts`, `packages/lint/test/run.test.ts`

**Interfaces:**
- Consumes: Task 1's `LintResult.quiet`, `DEFAULT_RULES`.
- Produces: `ClassFragment.deliberate?: true`; `hasRtlSignal(text: string): boolean`; `isRtlLocalePath(path: string): boolean`; a summary rule entry `source/no-rtl-support` (severity `note`) in `RULES` and `DEFAULT_RULES`, documented in LINT.md, never produced by `lintText`.

- [ ] **Step 1: Write the failing tests**

`classes.test.ts`:
- JSX `<span dir="ltr" className="ml-2" />`, `<i aria-hidden="true" className="right-2" />`, `<div className="absolute pointer-events-none -left-10" />`, `<div className="fixed pointer-events-none right-0" />` give fragments with `deliberate: true`; `<div className="absolute left-2" />` does not.
- The same four as HTML attributes in an `.html` file.
- physical-tailwind gives no hit for a deliberate fragment.

`rtl-signal.test.ts`: `hasRtlSignal` is true for `dir="rtl"`, `dir={isRtl ? 'rtl' : 'ltr'}`, `dir: 'rtl'`, `rtl:mr-2`, `:dir(rtl)`, `[dir=rtl]`, `[dir="rtl"]`, `html.rtl .a`, `isRTL`; false for `ltr`, `shortly`, `control:`. `isRtlLocalePath` is true for `locales/ar.json`, `i18n/ar-SA.po`, `lang/he/common.json`, `translations/fa_IR.yml`, `ur.json`; false for `src/area.ts`, `car.json`.

`run.test.ts`: a temp repo with no RTL signal and three files with physical CSS or classes gives exactly one finding, rule `source/no-rtl-support`, severity `note`, at the first physical finding's file and line, message `3 sides are set left or right. This repo has no right-to-left support yet; start here.`; with one `rtl:` class anywhere the three findings are reported as usual and no summary appears. `ignore: ['source/no-rtl-support']` keeps the individual findings.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/lint/test; echo EXIT=$?` — Expected: FAIL.

- [ ] **Step 3: Implement**

Deliberate flags come from the element that owns the class attribute (JSX opening element or parse5 element). `lint()` already reads every file once: test each file's text with `hasRtlSignal` and each walked path, plus file names under the repo top found by a bounded directory scan (depth 6, skipping ignored and `node_modules` directories), with `isRtlLocalePath`. After all files are linted, if no signal was seen, replace every physical-css and physical-tailwind finding with the single summary finding. The message uses the count with a thousands separator.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/lint packages/cli; echo EXIT=$?` — Expected: PASS.

- [ ] **Step 5: Commit**

`feat(lint): skip deliberate geometry and summarise repos with no right-to-left support`

---

### Task 3: Vue and Svelte files

**Files:**
- Modify: `packages/lint/src/types.ts`, `packages/lint/src/parse.ts`, `packages/lint/src/walk.ts`, every rule's `langs`, `packages/lint/LINT.md`, `packages/cli/src/cli.ts` (help line listing file types)
- Test: `packages/lint/test/parse.test.ts`, `packages/lint/test/run.test.ts`

**Interfaces:**
- Produces: `Lang` gains `'vue' | 'svelte'`. A component file yields `html` (the parse5 document of the whole file), `css` blocks from `<style>` (scss when `lang="scss"`, css otherwise; `lang` of `less`, `stylus` or `sass` is skipped), `js` blocks from `<script>` (ts when `lang="ts"` or `lang="tsx"`, else js).

- [ ] **Step 1: Write the failing tests**

- `parse.test.ts`: a `.vue` file with `<template><div class="ml-2">x</div></template>`, `<style lang="scss" scoped>.a { margin-left: 1px; .b { padding-right: 2px } }</style>` and `<script setup lang="ts">const a: number = 1</script>` gives one scss block, one ts block, and an html document; offsets point into the file text.
- A `.svelte` file with markup at top level, `<style>`, and `<script lang="ts">`.
- A `.vue` file whose `<script>` does not parse is skipped by `lint()` with reason starting `parse error:`.
- `run.test.ts`: lint on a temp project with a `.vue` file holding `class="pl-4"` (tailwind 3.4 fixture) and a scoped style with `margin-left` reports both with correct line numbers.

- [ ] **Step 2: Verify they fail.** `npx vitest run packages/lint/test/parse.test.ts; echo EXIT=$?`

- [ ] **Step 3: Implement** by reusing the HTML path with the `lang` attribute choosing the parser per block. Dynamic bindings (`:class`, `class:x`, `{expr}`) are not read; only static class text.

- [ ] **Step 4: Run** `npx vitest run packages/lint packages/cli; echo EXIT=$?` — PASS.

- [ ] **Step 5: Commit** `feat(lint): read Vue and Svelte components`

---

### Task 4: CSS in tagged template literals

**Files:**
- Create: `packages/lint/src/css-in-js.ts`
- Modify: `packages/lint/src/parse.ts`, `packages/lint/LINT.md`
- Test: `packages/lint/test/css-in-js.test.ts`

**Interfaces:**
- Produces: `templateCss(block: JsBlock, text: string): CssBlock[]`, called by `parseSourceOutcome` for js, jsx, ts and tsx files (and component script blocks), appended to `SourceFile.css`.

- [ ] **Step 1: Write the failing tests**

- Tags read: `styled.div`, `styled(Button)`, `styled.div.attrs({})`, `styled('div')`, `css`, `createGlobalStyle`, `injectGlobal`, `keyframes` is not read.
- `` styled.div`margin-left: ${p => p.gap}px; color: red;` `` gives a physical-css hit at the line and column of `margin-left` in the source.
- `` styled.div`${mixin}; padding-right: 4px;` `` (whole-declaration position) parses and reports `padding-right`.
- `` css`margin-${side}: 4px;` `` (property-name position) parses without a finding and without throwing.
- Multi-line templates with `${}` spanning lines keep later line numbers right.
- A template that still does not parse adds no block and does not fail the file.

- [ ] **Step 2: Verify they fail.** `npx vitest run packages/lint/test/css-in-js.test.ts; echo EXIT=$?`

- [ ] **Step 3: Implement.** Build the CSS text from the template source with each `${…}` replaced by a string of exactly the same length (newlines kept) so offsets map one to one: a comment `/*…*/` when the expression stands where a declaration starts (after `{`, `;` or only whitespace on its line, and followed by optional `;`), otherwise an identifier made of `x`. Parse with postcss-scss so nesting works. The block's offset is the first quasi's start.

- [ ] **Step 4: Run** `npx vitest run packages/lint packages/cli; echo EXIT=$?` — PASS. Also lint the Twenty clone at `~/Documents/Code/dualkit-sweep-data` (path in the controller's dispatch) and report the time, which must stay under 18 s.

- [ ] **Step 5: Commit** `feat(lint): read CSS in styled and css template literals`

---

### Task 5: Check reads only what an Arabic reader sees

**Files:**
- Modify: `packages/rules/src/dom/styles.ts`, `packages/rules/src/dom/hidden.ts`, `packages/rules/src/dom/reader.ts`, `packages/rules/src/model.ts`, `packages/rules/src/rules/layout.ts`, `packages/rules/src/rules/type.ts`, `packages/rules/src/dom/path.ts`, `packages/rules/RULES.md`
- Test: `packages/rules/test/reader-fixes.test.ts`, `packages/rules/test/verify.test.ts` (existing fixtures may need updated expectations; each change to an existing expectation is listed in the report with its reason)

**Interfaces:**
- Produces: `LayoutNode.textSlack: number` (content box width minus the widest line of the element's own text, in px; 0 when it has no own text); `rtlScoped(selector: string): boolean` in styles.ts; `clippedAway(el: Element): boolean` in hidden.ts.

- [ ] **Step 1: Write the failing tests** (Playwright page fixtures, as the existing reader tests do)

- A `dir="rtl"` page with `[dir="rtl"] .a { margin-right: 8px }`, `:dir(rtl) .b { padding-left: 4px }`, `.rtl .c { left: 0 }` (with `html.rtl`) and `html[lang^="ar"] .d { float: right }` gives no physical-spacing or physical-inset hit; the same declarations under unscoped selectors still do.
- An element with inline `style="margin-left: 12px"` gives no hit.
- An element translated to `translateX(110vw)`, and a slide fully outside an `overflow: hidden` track, give no hit from any rule (use 11px Arabic text in them, which arabic-size would flag if visible).
- text-align-left: a 400px block with short Arabic text and `text-align: left` is flagged; an inline-block span that shrink-wraps the same text is not; a block whose text is mostly digits and Latin is not.
- arabic-tracking: 0.15px at 16px is not flagged; 0.5px at 9px is; 0.4px at 16px is (boundary 0.025em inclusive).
- Selectors: an element with `id`, with `data-testid`, and with a class combination unique on the page get those as their node id; otherwise the old chain.

- [ ] **Step 2: Verify they fail.** `npx vitest run packages/rules/test/reader-fixes.test.ts; echo EXIT=$?`

- [ ] **Step 3: Implement** with the signatures above. `clippedAway` intersects the element's box with the horizontal viewport range `[0, clientWidth]` and with each ancestor whose computed `overflow-x` is not `visible`; empty intersection means skipped. The reader applies it to every node kind.

- [ ] **Step 4: Run** `npm test -w @dualkit/rules; echo EXIT=$?` — PASS.

- [ ] **Step 5: Commit** `fix(rules): judge layout and tracking by what renders, skip unseen elements`

---

### Task 6: Versions, docs and release surfaces

**Files:**
- Modify: `packages/lint/package.json` (0.2.0-beta.0), `packages/rules/package.json` (0.3.0-beta.0), `packages/cli/package.json` (0.4.0-beta.0 and its dependency ranges), `packages/lint/README.md`, `packages/cli/README.md`, `README.md`, `apps/site/lib/updates.ts`, `apps/site/app/docs/page.tsx`, `apps/site/lib/v3/testcount.ts` (rerun the count script)
- Test: existing site and package tests

The controller supplies the measured before and after numbers in the dispatch. The /updates entry states them plainly, names what changed for users (fewer false findings, Vue, Svelte and CSS-in-JS, the dir-attribute rule off by default, tracking threshold), and links the sweep report. No claim beyond the measured numbers.

- [ ] **Step 1:** Update the files. **Step 2:** `npm run typecheck; echo EXIT=$?` and `npm test; echo EXIT=$?` at the root — both 0. **Step 3:** Commit `chore: release lint 0.2, rules 0.3 and CLI 0.4 betas`.
