# dualkit lint (Part B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@dualkit/lint` 0.1.0-beta.0 and `dualkit lint` in CLI 0.3.0-beta.0: eight source rules that find Arabic and RTL bugs in CSS, SCSS, HTML, JS, TS, JSX and TSX before anything renders.

**Architecture:** A new workspace package `packages/lint` holds a file walker, three parsers behind one `SourceFile` interface, suppression comments, the rule registry and a LINT.md generator. Rules are pure functions over parsed files that return `LintHit`s. The CLI gains a `lint` command that reuses the `check` config, output style and exit codes. The GitHub Action gains a `mode` input.

**Tech Stack:** TypeScript (ES2022 lib, strict, `exactOptionalPropertyTypes`), tsup, vitest 3, postcss + postcss-scss, @babel/parser, parse5, `ignore` (gitignore matching), `semver`.

**Spec:** `docs/superpowers/specs/2026-10-20-rules-and-linter-design.md`, section "Part B: `dualkit lint` (PR 2)" plus "The proof standard", "Release" and "Calls settled after the builder check".

## Global Constraints

- Anti-goal: no false positive on correct, idiomatic code. Every rule has a near-miss negative test for the most likely way it could fire wrongly.
- Anti-goal: no regex over JavaScript. JS, TS, JSX and TSX rules read the Babel AST, so a match inside a comment or an unrelated string never fires.
- Proof standard: each rule has 1 firing fixture and at least 2 that do not, one of them the nearest correct pattern. Every fact (Tailwind class and the version that added it, CLDR default digits, calendar ids, code points) is cited with source and confidence in `docs/research/2026-10-20-rules-facts.md`, and only VERIFIED facts back a rule.
- `LintFinding` is the lint package's own type: `{ rule, group: 'source', severity, title, message, fix, docs, file, line, column }`. It imports `Severity` from `@dualkit/rules`. The rules `Finding` type does not change.
- Docs links point at `https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md#<anchor>`, with the anchor built the same way as `docsUrl` in `packages/rules/src/run.ts`.
- Exit codes: 0 when clean, 1 when any finding is at or above `--fail-on` (default `error`), 2 for a usage error. This matches `check`.
- The walker honours `.gitignore` (root and nested) and always skips `node_modules`, `dist`, `.next`, `build`, `coverage` and `.git`.
- Symmetric pairs never fire: `left: 0; right: 0` and `margin-left: auto; margin-right: auto` in one block (the same property pair with identical values), and `mx-`, `px-`, `inset-x-` in Tailwind.
- Tailwind below 3.3 stays quiet. A replacement that needs a later version than the one installed is left out of the fix text (for example `inset-s-` needs 4.2).
- `dualkit lint` assumes the project ships right-to-left. It does not try to detect that.
- Out of scope: Vue, Svelte, Astro and MDX files, and CSS-in-JS template strings.
- Copy: no em dashes in anything a user reads. Plain sentences in the existing RULES.md voice.
- Commits: named files only, never `git add -A`. Conventional prefix. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before any push, run root `npm run typecheck`. The lib is ES2022: no `findLast`, `findLastIndex`, `toSorted` or `Array.prototype.at` on tuples typed outside ES2022.

## Review Focus

1. **Real source shapes.** Production React, Next.js and Tailwind code: `className={cn('ml-2', cond && 'pl-4')}`, template literals with `${}` parts, `cva` variant objects, Tailwind prefixes and `!important` (`!ml-2`), negatives (`-ml-2`), arbitrary values (`ml-[3px]`), variant stacks (`md:hover:ml-2`, `rtl:md:ml-2`). Expected: physical classes are found in the static parts, `rtl:`/`ltr:` anywhere in a variant stack is skipped, and dynamic parts are never guessed. Tests in Task 4.
2. **Unparseable and odd files.** A file with a syntax error, a minified bundle that `.gitignore` misses, a 2 MB generated file, a `.ts` file with `<T>x` casts (it must not be parsed with the JSX plugin), a BOM, CRLF line endings. Expected: no crash, a skipped file is named on stderr, line and column stay right with CRLF, and minified files over 1 MB or with an average line length over 500 are skipped. Tests in Task 2.
3. **SCSS nesting and direction scoping.** `[dir="rtl"] & { margin-left: 0 }`, `:dir(rtl) .x { left: 0 }`, `#{$side}` interpolation, mixins. Expected: a declaration under a direction-scoped selector (`[dir=…]`, `:dir()`, `:lang(ar)`) is a deliberate override and does not fire `physical-css`. Interpolated property names are never guessed. Tests in Task 3.
4. **Locale and options that are not literals.** `new Intl.NumberFormat(locale)`, `toLocaleString(undefined, opts)`, `{ ...base, numberingSystem: 'latn' }`, `['ar-AE', 'en']`. Expected: rules fire only when the Arabic locale and the options are statically known. A spread or a non-literal argument makes the rule stay quiet. Tests in Task 5.
5. **Linux CI and paths.** Paths with spaces, Windows-style `\r\n`, symlinks back into the tree, case-sensitive file systems. Expected: findings use paths relative to the lint root with forward slashes, and a symlink loop cannot hang the walker. Tests in Task 2.

---

### Task 1: Facts for the source rules

**Files:**
- Modify: `docs/research/2026-10-20-rules-facts.md` (new section "10. Source rules (Part B)", and a row in the Tally)

**Interfaces:**
- Produces: a VERIFIED table that Task 4 encodes as `TAILWIND_MAP`, with these columns: physical class family, logical replacement, Tailwind version that added the replacement, source URL. Also VERIFIED facts that Task 5 encodes: CLDR default numbering system for `ar`, `ar-AE`, `ar-SA`, `ar-EG`, `ar-MA` in the CLDR versions shipped by Node 18, 20 and 22 (read `Intl.NumberFormat(l).resolvedOptions().numberingSystem` and `process.versions.cldr` on each if available, or the CLDR release notes); the valid `islamic-*` calendar ids in ECMA-402 and CLDR; which one Saudi Arabia uses officially (Umm al-Qura), with source.

- [ ] **Step 1:** For every family in the spec's `source/physical-tailwind` row (`ml mr pl pr left right text-left text-right rounded-l rounded-r` plus the corner forms `rounded-tl/tr/bl/br`, `border-l border-r`, `float-left float-right`, `scroll-ml scroll-mr scroll-pl scroll-pr`), find the logical class and the release that added it, from the Tailwind changelog or the docs (v3.3 blog post, v3.4, v4.x). Mark each row VERIFIED (primary source read) or UNVERIFIED. A family whose replacement can't be verified is listed as "no fix text" and still fires with a generic fix.
- [ ] **Step 2:** Record the CLDR and ECMA-402 facts above. For intl-digits, the claim to verify is "CLDR has changed the default digits for at least one Arabic locale between releases". Cite the CLDR ticket or release note. If it can't be verified, the rule's `why` must be reworded to a claim that is verified: the default depends on the locale and the runtime, so pin it.
- [ ] **Step 3:** Record U+FDFC (already in §3) by reference, and the HTML entity forms `&#xFDFC;`, `&#65020;` and `&#xfdfc;`. There is no named entity. Check the WHATWG entity list and state the result.
- [ ] **Step 4: Commit** `docs: facts for the source rules`.

### Task 2: The lint package and engine

**Files:**
- Create: `packages/lint/package.json` (name `@dualkit/lint`, version `0.1.0-beta.0`, the same scripts, `files`, `publishConfig`, `engines` and repository fields as `packages/rules/package.json`, with `directory: packages/lint`; dependencies `@dualkit/rules` `0.2.0-beta.0`, `postcss`, `postcss-scss`, `@babel/parser`, `parse5`, `ignore`, `semver`)
- Create: `packages/lint/tsconfig.json`, `packages/lint/tsup.config.ts` (esm + cjs + dts, entry `src/index.ts`), `packages/lint/README.md`, `packages/lint/LICENSE` (copy of the rules package licence)
- Create: `packages/lint/src/types.ts`, `src/walk.ts`, `src/parse.ts`, `src/suppress.ts`, `src/run.ts`, `src/docs.ts`, `src/rules/index.ts` (empty registry), `src/index.ts`
- Create: `packages/lint/test/walk.test.ts`, `test/parse.test.ts`, `test/suppress.test.ts`, `test/run.test.ts`, `test/docs.test.ts`, `packages/lint/LINT.md` (generated)
- Modify: `.github/workflows/ci.yml` (build `@dualkit/lint` after rules), `package-lock.json`

**Interfaces:**
- Produces, in `src/types.ts`:
  - `type Lang = 'css' | 'scss' | 'html' | 'js' | 'jsx' | 'ts' | 'tsx'`
  - `type SourceFile = { path: string /* relative to root, forward slashes */; abs: string; lang: Lang; text: string; css: { root: postcss.Root; offset: number }[]; js: { ast: babel.File; offset: number; lang: 'js'|'jsx'|'ts'|'tsx' }[]; html: parse5.DefaultTreeAdapterMap['document'] | null }`. An HTML file fills `html` and puts each inline `<style>` in `css` and each `<script>` in `js`, with `offset` being the block's start in `text`. A CSS or SCSS file has one `css` entry with offset 0.
  - `type LintHit = { offset: number; message: string }`. `offset` is a character index into `SourceFile.text`.
  - `type LintRule = { id: string; severity: Severity; title: string; why: string; fix: string; langs: readonly Lang[]; check: (file: SourceFile, ctx: LintContext) => LintHit[] }`
  - `type LintContext = { tailwindVersion: (file: SourceFile) => string | null }`. Task 4 fills in the real resolver. Task 2 passes one that returns null.
  - `type LintFinding = { rule: string; group: 'source'; severity: Severity; title: string; message: string; fix: string; docs: string; file: string; line: number; column: number }`, where line and column are 1-based.
  - `type LintResult = { root: string; files: number; skipped: { file: string; reason: string }[]; findings: LintFinding[] }`
- Produces, in `src/run.ts`: `lintDocsUrl(id: string): string`; `lintText(path: string, text: string, options?: { rules?: readonly LintRule[]; ignore?: readonly string[]; ctx?: Partial<LintContext> }): LintFinding[]` (pure, used by every rule test); `lint(paths: string[], options: { cwd: string; ignore?: readonly string[]; rules?: readonly LintRule[] }): Promise<LintResult>`. Findings sort by file, line, column, then rule.
- Produces, in `src/walk.ts`: `walk(paths: string[], cwd: string): { files: string[]; skipped: { file: string; reason: string }[] }`. It lists files with the extensions `.css .scss .html .htm .js .mjs .cjs .jsx .ts .mts .cts .tsx`, skips `.d.ts`, follows no symlinked directories, and records minified files as skipped (over 1 MB, or an average line length over 500).
- Produces, in `src/suppress.ts`: `suppressed(file: SourceFile, rule: string, line: number): boolean`. It honours `dualkit-disable-next-line <id>[, <id>]` in `//`, `/* */` and `<!-- -->` comments, and `dualkit-disable <id>` anywhere in the file for the whole file. A bare directive with no id disables every rule.
- Produces, in `src/docs.ts`: `renderLintMarkdown(rules: readonly LintRule[]): string`, in the same shape as `renderRulesMarkdown` in `packages/rules/src/docs.ts`, with a "Known limits" tail from `LINT_KNOWN_LIMITS: readonly string[]`.

- [ ] **Step 1: Failing tests.**
  - `walk.test.ts`, on a temp tree:
    - It honours a root and a nested `.gitignore`.
    - It always skips `node_modules`, `dist` and `.next`.
    - It skips `.d.ts`.
    - It skips a symlink to a parent directory without hanging.
    - It handles a path with a space.
    - A one-line 600 KB file with an average line length over 500 is skipped with reason `minified`.
  - `parse.test.ts`:
    - `.ts` with `const x = <T>y` parses (TS plugin without JSX), and `.tsx` parses JSX.
    - SCSS with `#{$side}` and `&` nesting parses.
    - An HTML file with `<style>` and `<script type="module">` gives one css and one js entry at the right offsets.
    - A syntax error returns `null`, and `lint()` lists the file in `skipped` with reason `parse error: <message>` and does not throw.
  - `run.test.ts`:
    - line and column for an offset in CRLF text, and in text with a BOM.
    - The `ignore` option drops a rule.
    - Sort order.
    - `lintDocsUrl('source/physical-css')` ends `LINT.md#source-physical-css`.
  - `suppress.test.ts`: every directive form above, and a directive inside a string literal, which does not count.
  - `docs.test.ts`: `LINT.md` equals `renderLintMarkdown(RULES)`. Use the `UPDATE_LINT_MD` env var to rewrite it, as `packages/rules/test/docs.test.ts` does.
- [ ] **Step 2:** Run `cd packages/lint && npx vitest run` and see the failures.
- [ ] **Step 3: Implement.**
  - Babel options: `sourceType: 'unambiguous'`, `errorRecovery: false`. Plugins: `['typescript']` for ts, mts and cts; `['typescript','jsx']` for tsx; `['jsx']` for js, jsx, mjs and cjs. A JS file that fails with jsx retries without it.
  - Directive detection reads Babel `comments`, postcss `comment` nodes and parse5 comment nodes, never raw text, so a directive inside a string is ignored.
- [ ] **Step 4:** Run the package tests. Regenerate LINT.md (empty registry: header plus Known limits) with `UPDATE_LINT_MD=1`. Run root `npm install` and `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(lint): engine, walker, parsers and suppression`.

### Task 3: CSS rules: `source/physical-css`, `source/arabic-letter-spacing`, `source/dir-attribute-selector`

**Files:**
- Create: `packages/lint/src/rules/css.ts`, `packages/lint/src/selectors.ts`
- Modify: `packages/lint/src/rules/index.ts`, `packages/lint/src/docs.ts` (limits), `LINT.md`
- Test: `packages/lint/test/rules/css.test.ts`

**Interfaces:**
- Consumes: `SourceFile.css`, `LintRule`, `lintText` (Task 2).
- Produces, in `src/selectors.ts`:
  - `fullSelectors(rule: postcss.Rule): string[]`, the rule's selectors joined with every ancestor rule's selectors (with `&` resolved).
  - `directionScoped(selector: string): boolean`, true for `[dir=…]` in any quoting, `:dir(…)` and `:lang(ar…)`.
  - `targetsArabic(selector: string): boolean`, true for `:lang(ar…)`, `[lang="ar…"]` / `[lang|="ar"]`, `:dir(rtl)` and `[dir="rtl"]`.

- [ ] **Step 1: Failing tests, in `css.test.ts`.**
  - `physical-css` fires on:
    - `margin-left`, `padding-right`, `left`, `right`, `border-left`, `border-right-width`
    - `border-top-left-radius` and the other 3 corners
    - `float: left`, `float: right`, `text-align: left`, `text-align: right`
    - each in both CSS and SCSS
  - The message names the logical property. The map is `margin-left→margin-inline-start`, `left→inset-inline-start`, `border-top-left-radius→border-start-start-radius`, `float: left→float: inline-start`, `text-align: left→text-align: start`, and so on.
  - Near-miss negatives that stay quiet:
    - `left: 0; right: 0` in one block
    - `margin-left: auto; margin-right: auto` in one block
    - `text-align: center`
    - `margin-inline-start`
    - `[dir="rtl"] .a { margin-left: 0 }` and the SCSS `[dir=rtl] & { … }` form
    - `.a:dir(rtl) { left: 0 }`
    - `#{$side}: 0`
    - a declaration in a comment
    - `left: 0; right: 4px` (this one fires both)
  - `arabic-letter-spacing` (error) fires on `:lang(ar) { letter-spacing: .05em }` and on `[dir="rtl"] h1 { letter-spacing: 1px }`, including in nested SCSS. It stays quiet on `letter-spacing: 0`, `normal`, `0px` and `0em`, and on a non-Arabic selector.
  - `dir-attribute-selector` (note) fires on `[dir="rtl"] .x` and `[dir=ltr]`. It stays quiet on `:dir(rtl)` and on a `[data-dir="rtl"]` attribute.
  - Inline `<style>` in HTML fires at the right line.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3: Implement the three rules in `src/rules/css.ts`.**
  - `physical-css` skips a declaration when any of its `fullSelectors` is `directionScoped`.
  - Symmetric pairs are matched per block on the same property pair with identical normalised values.
  - Each rule's `why` names the failure a person sees. The `fix` names the logical form.
- [ ] **Step 4:** Run the tests and see them pass. Regenerate LINT.md.
- [ ] **Step 5: Commit** `feat(lint): physical-css, arabic-letter-spacing and dir-attribute-selector`.

### Task 4: `source/physical-tailwind`

**Files:**
- Create: `packages/lint/src/rules/tailwind.ts`, `packages/lint/src/classes.ts`, `packages/lint/src/tailwind-version.ts`
- Modify: `packages/lint/src/run.ts` (the real `tailwindVersion` in the default context), `src/rules/index.ts`, `LINT.md`
- Test: `packages/lint/test/rules/tailwind.test.ts`, `test/classes.test.ts`, `test/tailwind-version.test.ts`

**Interfaces:**
- Consumes: Task 1's VERIFIED table, and `SourceFile.js`, `SourceFile.html` and `SourceFile.css` (`@apply`).
- Produces, in `src/classes.ts`: `classStrings(file: SourceFile): { offset: number; text: string }[]`. It reads every statically known class-list fragment from:
  - HTML `class` attributes
  - JSX `className` and `class` string literals and template-literal quasis
  - string, template-quasi, array and object-key arguments (recursively) to calls named `clsx`, `cn`, `cva`, `twMerge`, `twJoin` and `classnames`, including `cva` variant objects
  - CSS `@apply` params

  The offset is the fragment's start in `text`.
- Produces, in `src/tailwind-version.ts`: `tailwindVersion(fileAbs: string, root: string): string | null`. It walks up from the file to `root` and finds the nearest `package.json` that lists `tailwindcss` in dependencies, devDependencies or peerDependencies. It prefers the installed `node_modules/tailwindcss/package.json` version resolved from that folder, then `semver.minVersion(range)`, and otherwise returns null. Results are cached per folder.
- Produces, in `src/rules/tailwind.ts`: `TAILWIND_MAP: readonly { pattern: RegExp; replace: (cls: string) => string | null; since: string }[]`, built only from Task 1 VERIFIED rows.

- [ ] **Step 1: Failing tests.**
  - `classes.test.ts` covers each source form above, including `cn('a', cond && 'ml-2', { 'pr-4': x })` and `cva('ml-2', { variants: { side: { a: 'pl-2' } } })`.
  - Dynamic parts are not guessed. In `` `ml-${n}` `` the quasi `ml-` alone does not fire, because a class must be a whole token.
  - `tailwind-version.test.ts` uses temp trees:
    - The installed version wins over the range.
    - `^3.4.1` gives `3.4.1`.
    - No tailwind gives null.
    - A monorepo app folder gets its own version.
  - `tailwind.test.ts`, at version `3.4.0`:
    - It fires on `ml-2`, `mr-auto`, `-ml-2`, `!pl-4`, `md:hover:pr-2`, `ml-[3px]`, `left-0` alone, `text-left`, `rounded-l-lg`, `rounded-tr`, `border-l-2`, `float-left` and `scroll-ml-4`.
    - The fix text names the logical class only when `since` is at or below the installed version.
    - It stays quiet on: `rtl:ml-2`, `ltr:md:pr-4`, `md:rtl:ml-2`, `mx-2`, `px-4`, `inset-x-0`, `left-0 right-0` together (the symmetric pair), `ms-2`, `text-start`, `ml-2` at version `3.2.7` (below 3.3, quiet), and any of these in a non-class string such as `const label = 'ml-2'` outside a class source, or in a comment.
    - A Tailwind prefix config is out of scope. Add a Known limits line.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement. A variant stack is the part before the last `:` outside brackets, and any `rtl` or `ltr` segment in it skips the class.
- [ ] **Step 4:** Run the tests and see them pass. Regenerate LINT.md.
- [ ] **Step 5: Commit** `feat(lint): physical-tailwind`.

### Task 5: JS rules: `source/intl-digits`, `source/islamic-calendar`, `source/hijri-time-zone`, and `source/old-rial-sign`

**Files:**
- Create: `packages/lint/src/rules/intl.ts`, `packages/lint/src/rules/rial.ts`, `packages/lint/src/ast.ts`
- Modify: `src/rules/index.ts`, `LINT.md`
- Test: `packages/lint/test/rules/intl.test.ts`, `test/rules/rial.test.ts`

**Interfaces:**
- Consumes: `SourceFile.js`, `SourceFile.css` and `SourceFile.html`, plus Task 1's CLDR and calendar facts.
- Produces, in `src/ast.ts`:
  - `visit(node, fn)`, a small recursive walker over Babel nodes that skips `comments`.
  - `staticString(node): string | null`, which handles string literals and templates without expressions.
  - `staticLocales(node): string[] | null`, which returns null when not static.
  - `staticObject(node): Map<string, Node> | null`, which returns null when there is any spread or computed key.

- [ ] **Step 1: Failing tests.**
  - `intl-digits` fires on:
    - `new Intl.NumberFormat('ar-AE')`
    - `Intl.NumberFormat('ar')` without `new`
    - `new Intl.DateTimeFormat(['ar-SA','en'])`
    - `n.toLocaleString('ar-EG')`
    - `d.toLocaleDateString('ar', { month: 'long' })`
    - `d.toLocaleTimeString('ar-AE')`

    It stays quiet on:
    - `'ar-AE-u-nu-latn'` and `{ numberingSystem: 'arab' }`
    - `'en-AE'`
    - a non-literal locale
    - `{ ...opts }`
    - `undefined` as the locale
    - a `toLocaleString` on a user object with no args
    - text inside a comment
  - `islamic-calendar` fires on:
    - `{ calendar: 'islamic' }`
    - `'ar-SA-u-ca-islamic'`

    It stays quiet on:
    - `islamic-umalqura`, `islamic-civil` and `islamic-tbla`
    - `'islamic'` as an unrelated string, for example `const kind = 'islamic'`
  - `hijri-time-zone` fires on an Islamic-calendar `Intl.DateTimeFormat`, or on `toLocaleDateString` with an islamic calendar, when there is no `timeZone`. It stays quiet with `timeZone: 'Asia/Riyadh'`, and with a non-Islamic calendar.
  - `old-rial-sign` fires on U+FDFC raw in a JS string, JSX text, an HTML text node, an HTML attribute, a CSS `content` string, `&#xFDFC;` / `&#65020;` in HTML, and `﷼` / `\u{FDFC}` in a JS string. It stays quiet on U+FDFC in a JS or CSS comment, and on `ر.س` and `SAR`.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement. Hits point at the call's or the literal's start offset.
- [ ] **Step 4:** Run the tests and see them pass. Regenerate LINT.md.
- [ ] **Step 5: Commit** `feat(lint): intl-digits, islamic-calendar, hijri-time-zone and old-rial-sign`.

### Task 6: CLI, config, Action and publish workflow

**Files:**
- Create: `packages/cli/src/lint.ts`, `packages/cli/test/lint.test.ts`
- Modify:
  - `packages/cli/src/cli.ts`: the `lint` command, the help text, and `--fail-on`
  - `packages/cli/src/config.ts`: `ignore` accepts lint ids
  - `packages/cli/package.json`: version `0.3.0-beta.0`, dependency `@dualkit/lint` `0.1.0-beta.0`
  - `packages/cli/README.md`
  - `action/action.yml` and `action/README.md`
  - `.github/workflows/publish.yml`
  - `.github/workflows/action-selftest.yml`: add a lint job on a fixture folder

**Interfaces:**
- Consumes: `lint()`, `LintResult` and `RULES` from `@dualkit/lint`.
- Produces:
  - `formatLint(result: LintResult, color: boolean): string`. One line per finding, `path:line:col  <mark> <rule>  <message>`, using the same marks and colours as `formatSummary`. Then a blank line and `N errors, N warnings, N notes in F files`, or `No issues found in F files.`. Then, when anything was skipped, one line per skipped file.
  - `dualkit lint [paths…] [--json] [--fail-on error|warning|note] [--config <file>]`. Paths default to `.`. `--json` prints the `LintResult`.

- [ ] **Step 1: Failing tests in `lint.test.ts`, through `run()` with a fake `Io` the same way the existing cli tests do.**
  - Exit codes:
    - 0 when the code is clean.
    - 1 with an error finding.
    - 0 with only warnings at the default fail-on.
    - 1 with warnings at `--fail-on warning`.
    - 2 for `--fail-on bogus`.
    - 2 for a path that doesn't exist.
  - `--json` parses and has `findings[0].file` relative to cwd with forward slashes.
  - The config `ignore` with a lint id drops it, an unknown id is still a usage error, and a check id is still accepted.
  - `dualkit check` behaviour is unchanged. The existing tests still pass.
- [ ] **Step 2:** Run the tests and see them fail.
- [ ] **Step 3:** Implement the CLI change.
  - Action: add a `mode` input (`check` default, or `lint`) and a `paths` input (default `.`). Ruling: the existing `command` input stays as is, because it already means "how to run the CLI". The spec's "command input" is named `mode` to avoid breaking existing workflows.
  - `url` becomes not required. Exit 2 with a clear message when `mode` is check and `url` is empty.
  - In lint mode the step writes a summary of rule counts, skips Playwright install and the report artifact, and fails the job on exit 1.
  - `publish.yml`: add `lint` to the options. `lint` resolves to `@dualkit/lint`. The prepare step builds rules before lint and cli.
- [ ] **Step 4:** Run the cli tests, then root `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(cli): dualkit lint`.

### Task 7: Dogfood, release surfaces and versions

**Files:**
- Create: `docs/research/2026-10-20-lint-dogfood.md`
- Modify:
  - `apps/site/lib/updates.ts`: a new entry, plus a roadmap step if one fits; the old entries stay
  - `apps/site/app/docs/page.tsx`: a lint section
  - `README.md` and `packages/cli/README.md`
  - `packages/lint/README.md`
  - `apps/site/lib/v3/testcount.ts`, regenerated with `node apps/site/scripts/count-tests.mjs`

- [ ] **Step 1:** Build the cli and run `node packages/cli/dist/cli.js lint .` on this repo.
  - In the dogfood file, list every finding with a verdict: real bug, deliberate (the code is direction-scoped or a fixture), or false positive.
  - Fix real bugs in their own `fix(site):` or `fix(starter):` commits.
  - Test fixtures and deliberate demo code (the "without Dualkit" hero) get a `dualkit-disable` directive with a one-line reason, or a path in the dogfood note. Never weaken a rule to pass.
  - A false positive stops the task: report BLOCKED with the evidence.
- [ ] **Step 2:** Add a /updates entry.
  - Slug `lint-0-1-0`, today's date, tags `['Check']`, version `dualkit 0.3.0-beta.0`.
  - The body lists the 8 rules in plain words, names any dropped candidate, and says lint needs no browser.
  - The `shipped` list has `@dualkit/lint 0.1.0-beta.0` and `dualkit 0.3.0-beta.0`.
- [ ] **Step 3:** Rule counts.
  - Where the copy counts rules in `dualkit check`, it stays 29.
  - Where the docs and READMEs introduce lint, they say "8 source rules", read from `@dualkit/lint` `RULES.length` where code can.
  - Ruling: the site's "29 rules in dualkit check" stat stays as it is. The spec's "37 rules" total appears only where both tools are counted together. If there is no such place, it appears nowhere.
- [ ] **Step 4:** Run root `npm run typecheck`, `npm test` (in the background, about 15 minutes) and `npm run build`. Regenerate the test count.
- [ ] **Step 5: Commit** `chore: lint 0.1.0-beta.0 and CLI 0.3.0-beta.0`.
