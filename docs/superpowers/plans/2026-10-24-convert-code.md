# Convert code implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx dualkit convert` turns an English React or Next.js app into an Arabic or bilingual one on a new git branch, with a report and proof that nothing broke.

**Architecture:** A new package, `@dualkit/convert`, holds every transform as a pure function from a parsed file to a list of text edits, plus an orchestrator that runs them across a repo and two phases (`convert`, then `convert --finish`). It reuses the parser, class reader and physical-to-logical tables in `@dualkit/lint`. The `dualkit` CLI wires the command and injects the browser parts (screenshots and `audit`) from Playwright, so the convert package never loads a browser. Judgement work (Arabic copy, regional suggestions) is done by the person's agent through a new `dualkit-convert` skill, filling a strings ledger the command writes.

**Tech stack:** TypeScript, Node 18.18+, `@babel/parser`, `postcss`, `parse5` (all already used by lint), Playwright 1.55.0 and pngjs 7.0.0 (already used by the CLI), vitest, tsup. Generated apps get `next-intl` 4.14.9, or `react-i18next` 17.1.6 with `i18next` 26.5.8.

**Spec:** `docs/superpowers/specs/2026-10-24-dualkit-convert-design.md`

## Global constraints

- Dualkit makes no model calls in convert. Judgement work runs on the person's own agent.
- Convert needs a git repo with a clean working tree and refuses otherwise with a one-line reason. It branches from the current commit and never pushes or touches their main branch.
- Branch names: `dualkit/bilingual` and `dualkit/arabic`. A branch that already exists is refused with a one-line reason.
- Modes: `bilingual` (English and Arabic with a switch, English unchanged) and `arabic` (in place, Arabic and right to left throughout, no switch).
- First version supports Next.js App Router and Vite React, styled with Tailwind v3, Tailwind v4, plain CSS or CSS modules. Anything else is refused with a one-line reason naming what is supported.
- Bilingual Next.js: locale in the URL, `localePrefix: 'as-needed'`, default locale `en`, so every English URL stays the same. Other React apps keep the locale in the cookie `dk-locale`, read before first paint.
- English match: Chromium, widths 390 and 1280, fonts loaded, animations off. A page passes when under 0.1% of pixels differ (`MAX_DIFF_RATIO = 0.001`). A pixel differs when any RGBA channel differs by more than 8.
- Every Arabic string drafted by a model is marked for a native speaker to check. Machine Arabic is never presented as final.
- Any page check cannot reach is listed in the report, never silently skipped.
- A second run changes nothing already converted.
- User-facing copy (CLI messages, report, skill, README): sentence case, plain English, no em dashes, no exclamation marks.
- Pin every new dependency to an exact version.
- Commits use `git -c user.email=248309534+selfydev@users.noreply.github.com -c user.name=selfydev commit` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage named files only, never `git add -A`.

## Rulings made while planning

- `Ruling: space-x-* and divide-x-* get rtl:space-x-reverse / rtl:divide-x-reverse appended on Tailwind v3, and are left alone on v4 — the spec lists them as converted, but lint's research notes they have no logical class; v3 needs the reverse helper and v4 already uses margin-inline — if wrong, v4 apps show reversed gaps in Arabic, which check's layout rules and the screenshots surface.`
- `Ruling: Gulf formats are wired in narrowly — literal en-* locale arguments in Intl and toLocale*String calls inside a component that convert gave a translation hook are rewritten to the active locale through a generated dkIntlLocale helper; currency, week start and Hijri become report suggestions — the spec says "routed through @dualkit/format", but rewriting arbitrary formatting code mechanically is unsafe — if wrong, more becomes a suggestion than the spec intended, never a broken app.`
- `Ruling: arabic mode uses the same string extraction and ledger with one locale, ar — keeps one pipeline and keeps copy editable outside the code — costs one translation library in an Arabic-only app.`
- `Ruling: the language switch component is written but not placed — placing it would break the English match — the report and the skill tell the person or agent where to add it.`
- `Ruling: icons in inline SVG are not mirrored by convert, only named icon components from known icon packages — an inline SVG's meaning cannot be read safely from source — check's icons/arrow-points-forward still catches them after conversion.`
- `Ruling: signed-in pages use a Playwright storage state file named in config — the simplest login that works for any app — apps needing more get those pages listed as unreachable.`
- `Ruling: Next.js Pages Router is refused in this version — the spec scopes Next.js to what AI tools build, which is App Router — named in the refusal so the person knows.`

## Review focus

1. A Next.js app under `src/app` instead of `app`, or a repo where the app is one package of a monorepo, must be detected, not refused. Pinned in Task 2.
2. Running `convert` twice must make zero edits the second time, including the strings ledger and generated files. Pinned in Task 10.
3. A source file that does not parse must be skipped and listed in the report, never crash the run or be half-edited. Pinned in Task 10.
4. JSX text with nested elements (`Hello <b>{name}</b>`) or plurals must be flagged and left as it is, never mangled into a broken `t()` call. Pinned in Task 7.
5. A start command that never serves, exits early, or finds its port taken must fail with a clear message and leave no server process running. Pinned in Task 9.

## File structure

```
packages/convert/
  package.json, tsconfig.json, tsup.config.ts, README.md
  src/index.ts            public exports
  src/types.ts            Edit, Flag, FileResult, Project, Mode, ConvertState, LedgerEntry
  src/edits.ts            applyEdits, overlap check
  src/project.ts          detectProject
  src/transforms/tailwind.ts
  src/transforms/css.ts         CSS files, modules, inline <style>, JSX style objects
  src/transforms/markup.ts      icon mirroring, number isolation, ltr inputs
  src/transforms/strings.ts     extraction to t() calls
  src/transforms/formats.ts     literal locale rewrite
  src/generate/stylesheet.ts    dualkit.css
  src/generate/next-intl.ts     Next.js wiring
  src/generate/react-i18next.ts Vite wiring
  src/ledger.ts           dualkit-strings.json read, write, messages output
  src/git.ts              repo checks, branch, commit
  src/server.ts           start command lifecycle
  src/routes.ts           page list
  src/match.ts            pixel compare
  src/report.ts           dualkit-convert.md renderer
  src/convert.ts          phase 1 orchestrator
  src/finish.ts           phase 2 orchestrator
  test/fixtures/next-app/, test/fixtures/vite-app/, test/helpers.ts
packages/lint/src/index.ts       new exports
packages/cli/src/convert.ts      command, prompts, Playwright injections
packages/cli/src/cli.ts          dispatch and help
packages/cli/src/config.ts       convert config block
plugin/skills/dualkit-convert/SKILL.md
packages/skills/test/skills.test.ts
```

---

### Task 1: Package scaffold, lint exports and the edit model

**Files:**
- Create: `packages/convert/{package.json,tsconfig.json,tsup.config.ts}`, `src/index.ts`, `src/types.ts`, `src/edits.ts`, `test/edits.test.ts`, `test/helpers.ts`
- Modify: `packages/lint/src/index.ts`, `packages/lint/src/rules/css.ts` (export `PHYSICAL_PROPS`), `packages/rules/src/index.ts` (export `MIN_ARABIC_SIZE`, `MIN_ARABIC_LEADING` if not already)

**Interfaces:**
- Produces:
  - `type Edit = { start: number; end: number; text: string }` (offsets into `SourceFile.text`)
  - `type Flag = { file: string; line: number; kind: FlagKind; message: string; suggestion: string }`, `FlagKind = 'no-logical-form' | 'computed-class' | 'inline-svg-icon' | 'mixed-text' | 'outside-component' | 'format' | 'unparsed' | 'unsupported'`
  - `type FileResult = { edits: Edit[]; flags: Flag[] }`
  - `type Mode = 'bilingual' | 'arabic'`
  - `applyEdits(text: string, edits: Edit[]): string` throws `OverlapError` naming both edits when two overlap; equal-start inserts apply in given order.
  - `@dualkit/lint` newly exports `classStrings`, `ClassFragment`, `TAILWIND_MAP`, `TailwindEntry`, `PHYSICAL_PROPS`, `createTailwindVersion`, `parseSourceOutcome`, `walk`.
  - `ConvertConfig = { start?: string; port?: number; routes?: string[]; params?: Record<string, string>; storageState?: string; test?: string }` in `types.ts`.
  - `test/helpers.ts`: `fixtureRepo(name: 'next-app' | 'vite-app'): string` copies the fixture to a temp dir, runs `git init`, commits, and returns the path.
- Package name `@dualkit/convert`, version `0.1.0-beta.0`, `type: module`, ESM and CJS like lint, depends on `@dualkit/lint`, `@dualkit/rules`, `@dualkit/format` at their workspace versions.

- [ ] **Step 1:** Write `edits.test.ts`: applies three non-overlapping edits out of order to `'abcdef'` and gets the expected string; two inserts at offset 2 keep order; overlapping `{1,3}` and `{2,4}` throw `OverlapError`; empty list returns input unchanged.
- [ ] **Step 2:** Run `npx vitest run -w @dualkit/convert` (from repo root: `npm test -w @dualkit/convert`). Expected: FAIL, module not found.
- [ ] **Step 3:** Scaffold the package, implement `applyEdits` (sort by start descending, check neighbours), add the lint and rules exports.
- [ ] **Step 4:** Run `npm test -w @dualkit/convert && npm test -w @dualkit/lint && npm run typecheck -w @dualkit/lint`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add convert package and edit model`.

### Task 2: Project detection

**Files:** Create `src/project.ts`, `test/project.test.ts`, `test/fixtures/next-app/` (App Router, Tailwind v4, 4 pages: `/`, `/pricing`, `/orders/[id]`, `/settings`; a header with `ChevronRight` from lucide-react, a price, a phone input, a date via `toLocaleDateString('en-US')`), `test/fixtures/vite-app/` (React Router, plain CSS modules, Tailwind v3, 2 routes).

**Interfaces:**
- Produces `detectProject(root: string): Project` where `Project = { root: string; framework: 'next-app' | 'vite-react'; appDir: string | null; entry: string; tailwind: string | null; i18n: 'next-intl' | 'react-i18next' | null; packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' }`. `entry` is the root layout (`app/layout.tsx`) for Next or the file that calls `createRoot` for Vite. Throws `UnsupportedError` (message names what is supported) for Pages Router only, Remix, CRA, Vue, Svelte, Angular or no React.

- [ ] **Step 1:** Tests: next fixture gives `framework 'next-app'`, `appDir 'app'`, `tailwind` matching `/^4\./`; the same fixture with `app` moved to `src/app` gives `appDir 'src/app'`; vite fixture gives `'vite-react'` and its `main.tsx` entry; a repo whose root `package.json` has workspaces and the app in `apps/web` is detected when `root` is `apps/web`; a `pages/`-only Next app throws `UnsupportedError` whose message contains `App Router`; lockfiles map to the package manager.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement from `package.json` deps, lockfiles and file checks. Tailwind version through `createTailwindVersion`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit: `feat: detect project framework and styling`.

### Task 3: Tailwind transform

**Files:** Create `src/transforms/tailwind.ts`, `test/tailwind.test.ts`

**Interfaces:**
- Consumes `classStrings`, `TAILWIND_MAP`.
- Produces `tailwindEdits(file: SourceFile, version: string | null): FileResult`.
- Picks, for each class, the `TAILWIND_MAP` entry with the highest `since` not above `version`. Variants, `!` and the leading minus are kept (`md:-ml-2` to `md:-ms-2`). Fragments marked `sided` or `deliberate` are left alone. On v3, a class list with `space-x-*` or `divide-x-*` gets `rtl:space-x-reverse` or `rtl:divide-x-reverse` added once; on v4 nothing. Below 3.3.0 nothing is edited and one `unsupported` flag says to upgrade Tailwind to 3.3 or later.
- Flags `no-logical-form` with a suggestion for: `translate-x-*`, `-translate-x-*`, `bg-gradient-to-{l,r,tl,tr,bl,br}`, `bg-linear-to-{l,r,...}`, `origin-{left,right,...}`, `bg-{left,right,...}`, `object-{left,right,...}`, `rotate-*`, `skew-x-*`, and arbitrary shadows with a non-zero x offset. Flags `computed-class` once per `className` template literal that contains `${`.

- [ ] **Step 1:** Tests, one assertion each: `ml-4 pr-2 text-left rounded-l-lg border-r` becomes `ms-4 pe-2 text-start rounded-s-lg border-e` on 4.1; `left-0` becomes `start-0` on 3.4 and `inset-s-0` on 4.2; `hover:!-mr-1` becomes `hover:!-me-1`; `space-x-4` gains `rtl:space-x-reverse` on 3.4 and is unchanged on 4.1; a `dir="ltr"` element's classes are untouched; `translate-x-2` is unchanged and flagged; classes inside `cn('ml-2', cond && 'pl-1')` are both converted; version `3.2.0` edits nothing and returns one `unsupported` flag; running the transform on its own output returns zero edits.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: convert physical Tailwind classes`.

### Task 4: CSS transform

**Files:** Create `src/transforms/css.ts`, `test/css.test.ts`

**Interfaces:**
- Consumes `PHYSICAL_PROPS`, `SourceFile.css`, `SourceFile.js`.
- Produces `cssEdits(file: SourceFile): FileResult`, covering CSS and SCSS files, CSS modules, inline `<style>` blocks and JSX `style={{...}}` objects.
- Converts: every `PHYSICAL_PROPS` property; `text-align: left|right` to `start|end`; `float` and `clear` `left|right` to `inline-start|inline-end`; a 4-value `margin` or `padding` whose second and fourth values differ to `margin-block: <1> <3>; margin-inline: <4> <2>`. JSX objects: the camelCase forms (`marginLeft` to `marginInlineStart`, `textAlign: 'left'` to `'start'`, `left` to `insetInlineStart`).
- Leaves alone what lint already treats as not a bug: symmetric pairs, off-screen and centring patterns, rules under `[dir]` or `:dir()` selectors, blocks a build-time flipper already mirrors.
- Flags `no-logical-form`: `transform` with `translateX` or `translate(` with a non-zero x, `background-position` with `left` or `right`, `box-shadow` with a non-zero x offset, 4-value `border-width` and `border-radius` with differing sides.

- [ ] **Step 1:** Tests: `margin-left:8px` becomes `margin-inline-start:8px`; `margin: 0 8px 0 16px` becomes the two logical lines; `margin: 0 8px` is unchanged; `left:0; right:0` on one rule is unchanged; a rule under `[dir="rtl"]` is unchanged; `style={{ marginLeft: 4, textAlign: 'right' }}` becomes `style={{ marginInlineStart: 4, textAlign: 'end' }}`; `transform: translateX(4px)` is flagged and unchanged; output re-run gives zero edits.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: convert physical CSS`.

### Task 5: Markup transform

**Files:** Create `src/transforms/markup.ts`, `test/markup.test.ts`

**Interfaces:**
- Produces `markupEdits(file: SourceFile): FileResult`.
- **Icons:** JSX elements whose name is imported from `lucide-react`, `@heroicons/react/*`, `@radix-ui/react-icons`, `react-icons/*`, `@tabler/icons-react` or `@phosphor-icons/react` and matches `MIRROR_ICON = /(Arrow|Chevron|Chevrons|Caret|Angle|Triangle)(Left|Right)|ArrowBack|ArrowForward|Undo|Redo|Reply|Forward|Send|LogIn|LogOut|SignIn|SignOut|Indent|Outdent/`, and not `NEVER_MIRROR = /Play|Pause|FastForward|Rewind|Skip|Clock|Timer|Check|Music|Logo|Brand|Github|Twitter|X$/`, get the attribute `data-dk-mirror=""`. An element that already has it is untouched. Inline `<svg>` inside a `button` or `a` whose label reads back or next is flagged `inline-svg-icon`.
- **Numbers:** a JSX expression child whose expression is a call ending in `toLocaleString`, `toFixed`, `format` (any `Intl.*Format(...).format(x)` or a function whose name starts with `format`), or an identifier or member whose last name matches `/(price|amount|total|subtotal|cost|fee|balance|phone|mobile|tel|qty|quantity|count)$/i`, is wrapped `<bdi>{...}</bdi>` unless its parent is already `bdi` or has `dir`.
- **Inputs:** `<input>` with `type` `tel`, `email` or `url` and no `dir` gets `dir="ltr"`.

- [ ] **Step 1:** Tests: `<ChevronRight />` from lucide gains `data-dk-mirror=""`; `<PlayIcon />` from heroicons does not; a `ChevronRight` from a local file does not; `{price}` becomes `<bdi>{price}</bdi>`, `{order.total.toFixed(2)}` too, `{name}` does not; `<bdi>{price}</bdi>` is untouched; `<input type="tel" />` gains `dir="ltr"`; output re-run gives zero edits.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: mirror icons and isolate numbers`.

### Task 6: Arabic stylesheet

**Files:** Create `src/generate/stylesheet.ts`, `test/stylesheet.test.ts`

**Interfaces:**
- Produces `dualkitCss(project: Project): string` and `importEdit(entry: SourceFile, cssPath: string): Edit | null` (null when the import is already there).
- The file is written at `<appDir or src>/dualkit.css` and holds, in order: the Google Fonts `@import` for IBM Plex Sans Arabic weights 400, 500, 600, 700 with `display=swap`; `:lang(ar)` with `font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif` and `line-height: 1.7`; `:lang(ar) *` with `letter-spacing: 0`; for Tailwind projects `:lang(ar) .text-xs, :lang(ar) .text-\[10px\], :lang(ar) .text-\[11px\], :lang(ar) .text-\[12px\], :lang(ar) .text-\[13px\]` with `font-size: <MIN_ARABIC_SIZE>px`; and `[dir="rtl"] [data-dk-mirror] { scale: -1 1 }`. Every rule is scoped to `:lang(ar)` or `[dir="rtl"]`, so English renders exactly as before.

- [ ] **Step 1:** Tests: output contains each rule above; every selector in it starts with `:lang(ar)` or `[dir="rtl"]` (parse with postcss and check), except the `@import`; `importEdit` adds `import './dualkit.css'` after the last import of `app/layout.tsx` and returns null on a second call.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: generate the Arabic stylesheet`.

### Task 7: String extraction and the ledger

**Files:** Create `src/transforms/strings.ts`, `src/ledger.ts`, `test/strings.test.ts`, `test/ledger.test.ts`

**Interfaces:**
- Produces:
  - `extractStrings(file: SourceFile, lib: 'next-intl' | 'react-i18next', taken: Set<string>): FileResult & { entries: LedgerEntry[] }`
  - `type LedgerEntry = { key: string; en: string; ar: string; status: 'pending' | 'drafted' | 'reviewed'; file: string; line: number }`
  - `readLedger(root: string): LedgerEntry[]`, `writeLedger(root: string, entries: LedgerEntry[]): void` (file `dualkit-strings.json`, sorted by key, 2-space JSON, trailing newline)
  - `messagesFor(entries: LedgerEntry[], locale: 'en' | 'ar'): Record<string, unknown>` (nested by dotted key; for `ar`, a pending entry uses its `en` text so the app still runs)
- What counts as a user-facing string: JSX text with a letter in it, string literals as a JSX child, and string values of `alt`, `title`, `placeholder`, `aria-label`, `label`. Never `className`, `href`, `src`, `id`, `key`, `type`, `name`, `data-*` or `style`.
- Keys: `<file stem in kebab case>.<first 4 words, kebab case, ASCII only>`, deduplicated against `taken` with `-2`, `-3`.
- `Hello {name}` becomes `t('home.hello', { name })` with `en: 'Hello {name}'`. Text whose element also holds a child element (`Hello <b>{name}</b>`) or a plural-looking expression (`{count} item{count === 1 ? '' : 's'}`) is flagged `mixed-text` and left as it is.
- Hook: the nearest enclosing function whose name is PascalCase, or the default export, gets `const t = useTranslations()` (next-intl) or `const { t } = useTranslation()` (react-i18next) as its first statement, once; an async function gets `const t = await getTranslations()` from `next-intl/server`. An expression-bodied arrow becomes a block. The import is added once. Strings outside any component are flagged `outside-component`.
- The ledger keeps existing entries: a re-run only adds new keys and never resets `ar` or `status`.

- [ ] **Step 1:** Tests: `<h1>Welcome back</h1>` in `Home` becomes `<h1>{t('page.welcome-back')}</h1>` with the hook and import added once for two strings; `placeholder="Search"` becomes `placeholder={t('...')}`; `className="mt-2"` is untouched; the interpolation case; the mixed-text case is flagged and unchanged; an async server component gets `getTranslations`; a module-level `const LABELS = ['One']` is flagged `outside-component`; `writeLedger` then a second extraction with one new string keeps the first entry's `ar` and `status`; `messagesFor(entries, 'ar')` for a pending entry returns its English.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: extract strings to a translation ledger`.

### Task 8: Locale wiring and formats

**Files:** Create `src/generate/next-intl.ts`, `src/generate/react-i18next.ts`, `src/transforms/formats.ts`, `test/next-intl.test.ts`, `test/react-i18next.test.ts`, `test/formats.test.ts`

**Interfaces:**
- Produces `wireNextIntl(project: Project, mode: Mode): Plan` and `wireReactI18next(project: Project, mode: Mode): Plan`, where `Plan = { writes: Record<string, string>; edits: Record<string, Edit[]>; moves: [from: string, to: string][]; deps: Record<string, string> }` (paths relative to the project root). Pure: no disk writes.
- **Next, bilingual:** moves every route under `<appDir>/[locale]/` except `api`, `favicon.ico` and metadata files; writes `i18n/routing.ts` (`locales: ['en', 'ar']`, `defaultLocale: 'en'`, `localePrefix: 'as-needed'`), `i18n/request.ts`, `middleware.ts` (matcher skips `api`, `_next`, files with a dot), `messages/en.json`, `messages/ar.json`, `components/dualkit-language-switch.tsx`; wraps `next.config.*` with `createNextIntlPlugin`; the root layout reads `locale` from params, sets `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` and wraps children in `NextIntlClientProvider`.
- **Next, arabic:** no moves and no middleware; `i18n/request.ts` returns locale `ar`; `<html lang="ar" dir="rtl">`; only `messages/ar.json`.
- **Vite:** writes `src/i18n.ts` (i18next init, resources from `messages/*.json`, locale from the `dk-locale` cookie, default `en`, or fixed `ar` in arabic mode), an inline script in `index.html` that sets `lang` and `dir` on `<html>` from the cookie before first paint, the switch component in bilingual mode, and imports `./i18n` in the entry.
- `deps`: `next-intl: 4.14.9`, or `react-i18next: 17.1.6` and `i18next: 26.5.8`.
- Writes `lib/dualkit-locale.ts` exporting `dkIntlLocale(locale: string): string` (`'ar'` to `'ar-AE-u-nu-latn'`, anything else unchanged).
- `formatEdits(file: SourceFile, lib): FileResult`: in a component that has the translation hook, a literal `'en-*'` locale in `Intl.NumberFormat`, `Intl.DateTimeFormat`, `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString` becomes `dkIntlLocale(locale)`, adding `const locale = useLocale()` (next-intl) or using `i18n.language` (react-i18next). Elsewhere flagged `format`. `currency: 'USD'` is flagged `format` with the suggestion to offer AED with VAT shown. A date picker or calendar component from a known library is flagged `format` with the Saturday-first and Hijri suggestion.

- [ ] **Step 1:** Tests: bilingual Next plan moves `app/page.tsx` to `app/[locale]/page.tsx` and not `app/api/route.ts`; routing has `localePrefix: 'as-needed'` and `defaultLocale: 'en'`; arabic Next plan has no moves and `dir="rtl"` in the layout edit; Vite plan's inline script reads `dk-locale`; deps are the exact versions; `toLocaleDateString('en-US')` inside a hooked component becomes `toLocaleDateString(dkIntlLocale(locale))`; outside, it is flagged; `currency: 'USD'` is flagged.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: wire locales and Gulf formats`.

### Task 9: Server, routes and the English match

**Files:** Create `src/server.ts`, `src/routes.ts`, `src/match.ts`, `test/server.test.ts`, `test/routes.test.ts`, `test/match.test.ts`

**Interfaces:**
- Produces:
  - `startServer(cmd: string, port: number, cwd: string, timeoutMs = 120_000): Promise<{ url: string; stop: () => Promise<void> }>`. Spawns in its own process group, polls `http://localhost:<port>/` until any response under 500. Throws `ServerError` with the last 20 lines of output when the process exits early, the port is already taken before starting, or the timeout passes. `stop` kills the whole group and waits for exit.
  - `listRoutes(project: Project, config: ConvertConfig): { routes: string[]; unreachable: { route: string; reason: string }[] }`. Next: every `page.*` under the app dir, route groups `(x)` removed; a dynamic segment uses `config.params[route]` or goes to `unreachable` with the reason `needs sample params in dualkit.config.json`. Vite: `config.routes`, default `['/']`.
  - `compare(a: Buffer, b: Buffer): { ratio: number; diff: Buffer }`. PNGs of different sizes count as fully different. Uses pngjs; the channel tolerance and `MAX_DIFF_RATIO` come from Global constraints.

- [ ] **Step 1:** Tests: `startServer('node -e "require(\'http\').createServer((q,s)=>s.end(\'ok\')).listen(4517)"', 4517, tmp)` resolves and `stop` leaves no process on 4517; a command that exits at once throws `ServerError` containing its output; a taken port throws a message containing `already in use`; after any throw no child is left running; Next fixture lists `/`, `/pricing`, `/settings` and puts `/orders/[id]` in `unreachable` unless `params` maps it; two identical PNGs give ratio 0; one pixel off by 9 in a 100x100 image gives 0.0001; one off by 8 gives 0.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: serve, list and compare pages`.

### Task 10: Phase 1 orchestrator

**Files:** Create `src/git.ts`, `src/convert.ts`, `test/convert.test.ts`

**Interfaces:**
- Consumes everything above.
- Produces `convert(options: ConvertOptions, io: ConvertIo): Promise<ConvertSummary>`.
  - `ConvertOptions = { root: string; mode: Mode; install: boolean; baseline: boolean }`
  - `ConvertIo = { log: (s: string) => void; shoot?: Shooter; run: (cmd: string, cwd: string) => Promise<{ code: number; out: string }>; config: ConvertConfig }`
  - `type Shooter = (url: string, width: number) => Promise<Buffer>` (injected by the CLI)
  - `ConvertSummary = { branch: string; filesChanged: number; edits: number; flags: Flag[]; strings: number; skipped: { file: string; reason: string }[] }`
  - `ConvertState`, saved to `.dualkit/convert.json`: `{ mode, base: string, branch, framework, phase: 'converted' | 'finished' }`
- Order: refuse unless git repo and clean tree; detect project; create the branch from HEAD; if `baseline` and a start command is configured, start the server (Task 9's `startServer`), shoot every reachable English page at 390 and 1280 into `.dualkit/baseline/`, stop the server; walk the project with lint's `walk`; for each file, parse (unparsed files are skipped and listed, never edited), run tailwind, css, markup, strings and formats transforms, merge edits, apply once; apply the wiring plan (moves with `git mv`, then writes and edits); write `dualkit.css` and its import; write the ledger and messages; add deps to `package.json`; run the package manager install if `install`; add `.dualkit/` to `.gitignore`; save state; commit everything with the message `dualkit: convert to <mode>` using the person's own git identity.
- Re-running on a branch whose state says `converted` runs the transforms again and commits only if something changed.

- [ ] **Step 1:** Tests on `fixtureRepo('next-app')` with `install: false`, `baseline: false`: refuses a dirty tree with a message containing `uncommitted`; refuses when `dualkit/bilingual` exists; after a bilingual run the branch exists, `app/[locale]/page.tsx` exists, `dualkit-strings.json` has entries all `pending`, `app/dualkit.css` exists, no `ml-` class is left in the fixture's source, one commit was added; a second run adds no commit and makes zero edits; a fixture file with a syntax error is listed in `skipped` and its bytes are unchanged; arabic mode on `fixtureRepo('vite-app')` creates `dualkit/arabic` with `src/i18n.ts` fixed to `ar`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: run phase one of convert`.

### Task 11: Report renderer

**Files:** Create `src/report.ts`, `test/report.test.ts`

**Interfaces:**
- Produces `renderConvertReport(data: ReportData): string` (Markdown), where `ReportData = { mode: Mode; base: string; branch: string; summary: ConvertSummary; ledger: LedgerEntry[]; english: { route: string; width: number; ratio: number; diffPath?: string }[]; arabic: { route: string; score: number; errors: number; warnings: number }[]; unreachable: { route: string; reason: string }[]; remainingLint: number; tests?: { code: number; tail: string } }`.
- Sections, in order, each a `##` heading in sentence case: what changed (counts by kind with file links); Arabic copy to check (every `pending` or `drafted` entry, with the line "Drafted by a model. A native speaker should check these before release."); regional suggestions (every `format` flag, with why and how); English pages (bilingual only: each route and width, pass or fail with the diff path); Arabic pages (score and error count per route); what Dualkit could not convert (every other flag, every skipped file, every unreachable page); the app's tests (when run). An empty section says so in one line, never disappears.

- [ ] **Step 1:** Tests: every heading appears in order; a pending entry is listed under Arabic copy with the native speaker line; an English ratio of 0.002 shows as a fail with its diff path; an unreachable route appears with its reason; arabic mode has no English pages section; the output has no em dash.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: render the convert report`.

### Task 12: Phase 2 orchestrator

**Files:** Create `src/finish.ts`, `test/finish.test.ts`

**Interfaces:**
- Produces `finish(options: { root: string; force?: boolean }, io: FinishIo): Promise<{ reportPath: string; passed: boolean }>`, with `FinishIo = ConvertIo & { audit: (url: string, width: number) => Promise<{ score: number; errors: number; warnings: number }>; lint: (root: string) => Promise<number> }`.
- Order: read state (refuse when missing, with a message saying to run `dualkit convert` first); read the ledger and refuse while any entry is `pending` unless `force` (message gives the count); write `messages/en.json` and `messages/ar.json` from the ledger; start the server; for each route, in bilingual mode shoot English at both widths and compare against `.dualkit/baseline/` (no baseline gives the line "no English baseline was taken" in the report), and audit the Arabic page (`/ar<route>` for Next bilingual, the route itself in arabic mode, the route with the `dk-locale=ar` cookie for Vite bilingual); stop the server, also on error; run `config.test` if set; run lint for the remaining count; write `dualkit-convert.md`; set phase `finished`; commit `dualkit: finish <mode> conversion`.
- `passed` is true when every English page is under `MAX_DIFF_RATIO`, every Arabic page has zero errors, and the tests (if run) exit 0.

- [ ] **Step 1:** Tests with injected fakes for `shoot`, `audit`, `lint` and `run`, and a real `startServer` on a tiny static server: refuses with 3 pending entries and the message contains `3`; with `force`, writes both message files; a fake English shot differing by 1% makes `passed` false and the report lists the page; an `audit` that throws still stops the server; arabic mode audits `/` not `/ar/`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: run phase two of convert`.

### Task 13: CLI command

**Files:** Create `packages/cli/src/convert.ts`, `packages/cli/test/convert.test.ts`. Modify `packages/cli/src/cli.ts`, `packages/cli/src/config.ts`, `packages/cli/package.json` (depend on `@dualkit/convert`).

**Interfaces:**
- `dualkit convert [--mode bilingual|arabic] [--finish] [--force] [--no-install] [--no-baseline] [--start <cmd>] [--port <n>]`.
- Without `--mode` on a terminal, asks: `One app that switches between English and Arabic, or a separate Arabic version? [bilingual/arabic]`. Without a terminal and without `--mode`, exits 2 with `Pass --mode bilingual or --mode arabic.`
- Without a start command in config or flags, asks once for it and the port, and saves them under `convert` in `dualkit.config.json`; empty answer skips the baseline with a printed note.
- `loadConfig` accepts the `convert` block and validates every field type with a one-line `UserError`.
- Injects `shoot` (Playwright Chromium, `reducedMotion: 'reduce'`, waits for `document.fonts.ready`, uses `storageState` when set) and `audit` (the existing one) lazily, so `dualkit lint` still never loads Playwright.
- Prints, after phase 1: the branch, counts, and the next step: `Fill the Arabic in dualkit-strings.json, or ask your agent to use the dualkit-convert skill, then run dualkit convert --finish.` After phase 2: the report path and pass or fail. Exit 0 on pass, 1 on fail, 2 on a refusal.
- Help text gains the convert section in the same style as `lint`.

- [ ] **Step 1:** Tests using the existing `Io` pattern: `--mode` invalid exits 2 with the allowed values; no terminal and no mode exits 2 with the message above; a config with `convert.port: "x"` exits 2; `dualkit lint` does not import Playwright (existing test style); help contains `dualkit convert`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Commit: `feat: add dualkit convert command`.

### Task 14: Convert skill

**Files:** Create `plugin/skills/dualkit-convert/SKILL.md`. Modify `packages/skills/test/skills.test.ts` (five skills), the Cursor rule build if it lists skills, and any render-coverage list that enumerates skills.

**Interfaces:**
- Frontmatter: `name: dualkit-convert`, `description` starting `Use when converting an existing English React or Next.js app to Arabic or to English and Arabic`.
- Body under 900 words: run `npx dualkit convert` (ask the person which mode, never pick for them); fill every `pending` entry in `dualkit-strings.json` with natural Gulf Arabic, set `status` to `drafted`, never `reviewed`; the copy rules that matter (the bilingual-copy skill's register, Western digits unless asked, Arabic punctuation `،` `؛` `؟`); placing the language switch; working through regional suggestions only with the person's yes; run `npx dualkit convert --finish`; fix every Arabic page error and every English mismatch, then re-run finish; tell the person which strings need a native speaker.

- [ ] **Step 1:** Update `skills.test.ts` to expect five skills including `dualkit-convert`.
- [ ] **Step 2:** Run `npm test -w @dualkit/skills`. Expected: FAIL (skill missing).
- [ ] **Step 3:** Write the skill.
- [ ] **Step 4:** Run `npm test -w @dualkit/skills` and the Cursor build script. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add the dualkit-convert skill`.

### Task 15: Real-app smoke run and docs

**Files:** Create `docs/research/2026-10-24-convert-smoke.md`, `packages/convert/README.md`. Modify `packages/cli/README.md`, root `README.md`, `apps/site/lib/v3/testcount.ts` (via `node apps/site/scripts/count-tests.mjs`).

- [ ] **Step 1:** In the scratchpad, create a fresh `create-next-app` (App Router, Tailwind) and a fresh Vite React app, add a few physical classes, a lucide chevron and a price to each, commit, and run the built CLI with `--mode bilingual` on the Next app and `--mode arabic` on the Vite app, both with a start command.
- [ ] **Step 2:** Fill the ledger with placeholder Arabic (`status: drafted`), run `--finish`, open both report files and screenshot one Arabic page each. Record in the research note: commands, counts, pass or fail, and every defect found.
- [ ] **Step 3:** Fix every defect found, each with a test in the owning task's test file, and re-run until both pass.
- [ ] **Step 4:** Write the READMEs (what convert does, the two modes, the two phases, the config block, what it will not do) and run the test count script.
- [ ] **Step 5:** Run `npm test && npm run typecheck` from the root. Expected: PASS. Commit: `docs: convert smoke run and readmes`.

Site pages for convert and the proof app are the next plan, after Figma sign-off.
