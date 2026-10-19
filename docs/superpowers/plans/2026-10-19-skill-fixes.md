# Skill fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four Dualkit skills correct and self-consistent, so a build with Dualkit never fails a rule the same model passes alone, and prove it with tests that render every skill example through all 20 rules.

**Architecture:** A new test layer in `packages/skills/test` pulls fenced code out of each SKILL.md, scans it for banned patterns and undefined functions, and renders a fixture page built from the skills' good examples through the rules reader (Playwright, reused from `packages/rules/test/helpers/browser.ts`). Then each skill is fixed one at a time until its tests pass. Release surfaces follow.

**Tech Stack:** Markdown skills, Vitest, Playwright Chromium, `@dualkit/rules` (source import), `@dualkit/format` (source import).

**Spec:** `docs/superpowers/specs/2026-10-19-skill-fixes-design.md`

## Global Constraints

- Plain CSS and HTML attributes lead in every skill. Tailwind lives only in one closing `## In Tailwind` section in rtl-layout and type-pairing.
- Arabic text is never smaller than 14px for UI and 16px for body. `size-adjust` does not count toward the floor.
- No fenced code block in any skill contains `text-xs`, `text-[` with a size under 14px, `tracking-` other than `tracking-normal`, or a px font size under 14 (declaration or custom property). Banned classes appear only as inline code in prose.
- Every skill body stays under 900 words (existing test). Target ~70-90 lines.
- Dualkit voice: plain short sentences, sentence case, no em dashes, no marketing words. Match the existing skills.
- A skill never contradicts `packages/rules`, `@dualkit/format` or the starter. Where they disagree, the skill follows the rule and the starter, and the implementer reports the disagreement. Code in rules, format and starter is not changed in this project.
- Every factual claim about Unicode, Tailwind versions or currency signs is checked against an official source (unicode.org, tailwindcss.com, the central bank). The source URL goes in the task report.
- Rule-side blind spots found along the way go in the spec's "Notes for project 3" list, not into code.
- After any skill edit, regenerate Cursor rules: `npm run build -w @dualkit/skills-tooling` (writes `cursor/rules/*.mdc`). Commit them with the skill.
- Commits are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A good example that only passes because the fixture page around it supplies something the skill never says (a root `lang`/`dir`, an Arabic font, a body size). The fixture page shell must be minimal: `<html lang="ar" dir="rtl">`, `<meta charset>`, nothing else. Everything else comes from skill snippets. Test: Task 1 `renders the bare shell with findings` asserts the empty shell with one Arabic `<p>` and no skill CSS does produce `type/arabic-font`, so the shell can't hide a missing font.
2. A new fenced block added to a skill later with no fixture coverage, which would slip past the render test. Test: Task 1 `every renderable block is covered` fails on any css/html/tsx block that is neither quoted by a fixture entry nor listed in `UNRENDERED` with a reason.
3. Fixture drift: the skill text changes and the fixture keeps testing the old snippet. Test: Task 1 `each fixture quote appears verbatim in its skill`.
4. Banned patterns hidden in a Tailwind arbitrary value or an `em`/`rem` size below 14px (`text-[0.75rem]`, `font-size: .75rem`). Test: Task 1 ban-scan unit cases include `text-[0.75rem]` and `font-size: 0.75rem` (16px root) as banned and `text-[14px]`, `font-size: 1rem` as allowed.
5. A snippet calling a helper defined in a different block or never defined (`formatCount`). Test: Task 1 function-check unit case: a block calling `formatCount(n)` with no declaration fails; one declaring `const formatCount = ...` in the same block passes.

---

### Task 1: Skill test harness (red against today's skills)

**Files:**
- Create: `packages/skills/test/fences.ts` (pure helpers)
- Create: `packages/skills/test/fences.test.ts` (unit tests of helpers)
- Create: `packages/skills/test/examples.ts` (fixture entries)
- Create: `packages/skills/test/render.test.ts` (render, coverage and drift tests)
- Modify: `packages/skills/test/skills.test.ts` (ban scan and function check over real skills)

**Interfaces:**
- Produces, in `fences.ts`:
  - `type Fence = { skill: string; lang: string; code: string; section: string; index: number }`. `section` is the nearest `##` heading above the block. `index` counts blocks within the skill from 0.
  - `fencesOf(skill: string, markdown: string): Fence[]` returns every fenced block except those under a `## Common mistakes` heading.
  - `bannedIn(code: string): string[]` returns each banned match (see Global Constraints). Converts `rem`/`em` at 16px. Allowed: `text-sm` and up, `tracking-normal`, any size >= 14px.
  - `undefinedCalls(code: string, known: ReadonlySet<string>): string[]` returns bare identifiers called as functions (`name(`, not preceded by `.`, `new ` or a letter) that are not in `known`, not JS keywords (`if`, `for`, `while`, `switch`, `return`, `function`, `catch`), not standard globals (`String`, `Number`, `Boolean`, `Array`, `Object`, `Math`, `Date`, `Intl`, `parseInt`, `parseFloat`, `encodeURIComponent`), not CSS functions (callers skip `css` blocks), and not declared in the same block (`const|let|function NAME`).
- Produces, in `examples.ts`:
  - `type Example = { skill: string; quote: string; html: string; css?: string }`. `quote` is a verbatim substring of the skill (one distinctive line or more). `html` is what renders. `css` goes in a shared `<style>`.
  - `EXAMPLES: Example[]` plus `UNRENDERED: { skill: string; index: number; reason: string }[]` for blocks that can't render (TS-only import lines, `formatMoney` calls whose output is shown in comments).
- Consumes: `modelOf`, `closeBrowser` from `../../rules/test/helpers/browser`; `RULES`, `runRules` from `../../rules/src/index`; `* as format` from `../../format/src/index` (as the existing test does).

- [ ] **Step 1: Write the helper unit tests** in `fences.test.ts`

```ts
it('skips blocks under Common mistakes', () => {
  const md = '## A\n```css\na{}\n```\n## Common mistakes\n```css\nb{}\n```\n'
  expect(fencesOf('s', md).map((f) => f.code.trim())).toEqual(['a{}'])
})
it.each(['text-xs', 'text-[11px]', 'text-[0.75rem]', 'tracking-wide', 'font-size: 12px', 'font-size: 0.75rem', '--text-small: 12px'])('bans %s', (s) => expect(bannedIn(s)).not.toEqual([]))
it.each(['text-sm', 'text-[14px]', 'tracking-normal', 'font-size: 14px', 'font-size: 1rem', '--text-small: 14px', 'size-adjust: 112%'])('allows %s', (s) => expect(bannedIn(s)).toEqual([]))
it('flags a call to an undefined helper', () => expect(undefinedCalls('x.replace("{c}", formatCount(n))', new Set())).toEqual(['formatCount']))
it('accepts a helper declared in the block', () => expect(undefinedCalls('const formatCount = (n) => n\nformatCount(1)', new Set())).toEqual([]))
it('accepts known exports and globals', () => expect(undefinedCalls('formatMoney(1); new Intl.PluralRules("ar").select(2); String(1)', new Set(['formatMoney']))).toEqual([]))
```

- [ ] **Step 2: Run, verify they fail**

Run: `npm test -w @dualkit/skills-tooling -- fences`
Expected: FAIL, `fencesOf` not defined.

- [ ] **Step 3: Implement `fences.ts`** to pass. Line-based fence parsing (```` ```lang ```` to ```` ``` ````), regex scans.

- [ ] **Step 4: Run, verify pass.** Same command, expected PASS.

- [ ] **Step 5: Add real-skill tests** to `skills.test.ts`:

```ts
it.each(names)('%s has no banned size or tracking in its code', (name) =>
  expect(fencesOf(name, read(name)).flatMap((f) => bannedIn(f.code))).toEqual([]))
it.each(names)('%s only calls functions that exist', (name) =>
  expect(fencesOf(name, read(name)).filter((f) => f.lang !== 'css').flatMap((f) => undefinedCalls(f.code, new Set(Object.keys(format))))).toEqual([]))
```

- [ ] **Step 6: Write `examples.ts` from today's skills** (one entry per renderable good block: type-pairing `@font-face` and `:lang(ar)` rule, rtl-layout `<html lang dir>`, `<bdi dir="ltr">` phone hint, LRI/PDI string rendered as text, `<bdi>` amount, LTR input; bilingual-copy plural sentence rendered as text). The type-pairing example must give text the font family exactly as the skill writes it (today `'Brand'`).

- [ ] **Step 7: Write `render.test.ts`**

```ts
const shell = (css: string, body: string) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
it('renders the bare shell with findings', async () => {
  const ids = runRules(await modelOf(shell('', '<p>مرحبا بكم</p>'))).map((f) => f.rule)
  expect(ids).toContain('type/arabic-font')
})
it('each fixture quote appears verbatim in its skill', () => { for (const e of EXAMPLES) expect(read(e.skill)).toContain(e.quote) })
it('every renderable block is covered', () => { /* every fence with lang css|html|tsx is quoted by an EXAMPLES entry (quote is a substring of fence.code) or listed in UNRENDERED */ })
it('the good examples pass all 20 rules', async () => {
  const page = shell(EXAMPLES.map((e) => e.css ?? '').join('\n'), EXAMPLES.map((e) => e.html).join('\n'))
  expect(runRules(await modelOf(page)).map((f) => `${f.rule}: ${f.message}`)).toEqual([])
})
```

Check the `Finding` field names in `packages/rules/src/rule.ts` and use them. Call `afterAll(closeBrowser)`.

- [ ] **Step 8: Run the skills suite and record the red run**

Run: `npm test -w @dualkit/skills-tooling`
Expected: FAIL. At least `formatCount` (bilingual-copy) and `type/arabic-font` on `'Brand'` (type-pairing). Paste the failing lines into the task report. This red run is the rehearsal-2 bug in test form. If something listed in the spec doesn't fail, say so in the report.

- [ ] **Step 9: Commit**

```bash
git add packages/skills/test
git commit -m "test(skills): render every skill example through the rules"
```

The branch stays red until Task 5. That's expected, since CI only runs on the PR.

### Task 2: type-pairing

**Files:**
- Modify: `plugin/skills/dualkit-type-pairing/SKILL.md`
- Modify: `packages/skills/test/examples.ts`
- Regenerate: `cursor/rules/dualkit-type-pairing.mdc`

**Interfaces:** Consumes the Task 1 harness. Produces no code.

- [ ] **Step 1: Rewrite the skill** with these changes:
  - A size section near the top, stated as a rule: computed Arabic size is 14px or more for UI text and 16px for body. Name where small sizes creep in: badges, field labels, nav labels, the ر.س and د.إ abbreviations, VAT notes, calendar sub-labels. `size-adjust` makes Arabic look bigger, but it does not change the computed size, which is what checkers and the 14px floor measure.
  - Size tokens snippet scoped to Arabic, with names shaped like the starter's (`--type-label-size`, `--type-caption-size`, `--type-body-size`). It contains only values of 14px or more. It merges with the existing `:lang(ar)` rule (letter-spacing 0, no transform, normal style, line-height 1.7).
  - The `@font-face` example keeps `'Brand'`, but the usage line must list a real Arabic family after it, e.g. `font-family: 'Brand', 'IBM Plex Sans Arabic', sans-serif;`, with one sentence on why (fallback while loading, and the name tells tools and people which Arabic face is meant). Confirm this passes `type/arabic-font`.
  - Keep the `-apple-system` advice. Add one line: system font stacks are not a pairing, so name a web font.
  - The current "Use this plain CSS rule, even in a Tailwind project" paragraph moves into a closing `## In Tailwind` section: smallest step on Arabic is `text-sm` (14px), never `text-xs` or an arbitrary size under 14px, and `rtl:tracking-normal` beside any `tracking-*`.
  - The 14px row stays in the Do/Instead table.
- [ ] **Step 2: Update `examples.ts`** for the new snippets (token block applied to a `<label>`, a `.badge` with ر.س, and a `<small>` VAT note, all in Arabic).
- [ ] **Step 3: Run** `npm test -w @dualkit/skills-tooling`. Expected: no type-pairing failures remain (other skills may still fail).
- [ ] **Step 4: Regenerate Cursor rules** with `npm run build -w @dualkit/skills-tooling`, and check that the diff touches only the type-pairing `.mdc`.
- [ ] **Step 5: Commit** `fix(skills): type-pairing sets the Arabic size floor in the snippet`

### Task 3: rtl-layout

**Files:**
- Modify: `plugin/skills/dualkit-rtl-layout/SKILL.md`
- Modify: `packages/skills/test/examples.ts`
- Regenerate: `cursor/rules/dualkit-rtl-layout.mdc`

- [ ] **Step 1: Verify `inset-s-0`** against tailwindcss.com docs or changelog. Keep it with the confirmed version, or drop it. Put the source URL in the report.
- [ ] **Step 2: Rewrite the skill:**
  - The logical-properties table drops its Tailwind column (Physical, Logical only).
  - Transforms: plain CSS first (`[dir="rtl"] .x { transform: translateX(100%) }`).
  - Mirroring: `[dir="rtl"] .icon-directional { transform: scaleX(-1) }`. Keep the warning that rotate turns non-symmetric icons upside down.
  - Inputs section renamed from "Inputs that are always left to right". Fixed formats (phone, IBAN, Emirates ID, card, OTP) and email and URL use `dir="ltr"`. Fields where people may type either script (names, search, addresses, free text) use `dir="auto"`. Add one line saying the Dualkit starter Field uses `dir="auto"` on every input, which also works, because a value with no Arabic letters resolves to left to right. The label and error stay in page direction.
  - New `## Punctuation and brackets` section: Latin-led labels inside Arabic (translate the label, or isolate the Latin word: `<bdi>Gregorian</bdi>`); bracketed codes (`<bdi>(AED)</bdi>`, brackets inside the isolate, or use the Arabic abbreviation); mixed user content (`dir="auto"` on the block). Before you write each example, render the before and after in Chromium (`withPage` from the rules helper, or a scratch Playwright script) and save screenshots under `packages/skills/test/__shots__/` (gitignored) for the report. Each example must show the bug fixed by eye.
  - A closing `## In Tailwind` section has the class mapping (`ms-*`, `pe-*`, `start-*`, `text-start`, `border-s`, `rounded-ss-*`, `rtl:` variant, `rtl:-scale-x-100`). It says that in Arabic `text-sm` is the smallest size. Banned classes appear only as inline code.
  - Common mistakes adds: a Latin word leading an Arabic label, a bare `(AED)` in RTL, and `text-xs` badges in Arabic.
- [ ] **Step 3: Update `examples.ts`** for every new renderable block (punctuation examples, plain CSS mirror, inputs with `dir="auto"`).
- [ ] **Step 4: Run** `npm test -w @dualkit/skills-tooling`. Expected: no rtl-layout failures.
- [ ] **Step 5: Regenerate the Cursor rules.**
- [ ] **Step 6: Commit** `fix(skills): rtl-layout leads with CSS and covers punctuation`

### Task 4: bilingual-copy

**Files:**
- Modify: `plugin/skills/dualkit-bilingual-copy/SKILL.md`
- Modify: `packages/skills/test/examples.ts`
- Regenerate: `cursor/rules/dualkit-bilingual-copy.mdc`

- [ ] **Step 1: Edit the skill:**
  - Replace `formatCount(count)` with `new Intl.NumberFormat('ar-AE-u-nu-latn').format(count)`, inline or as a `const` in the same block. Pin the numbering system, consistent with gulf-formats.
  - Punctuation: "Arabic uses the same full stop as English. Only the comma, semicolon and question mark change: `،` `؛` `؟`." Check it against the other skills.
  - Add `## Two languages on one label`: when a label shows both languages stacked, each line gets its own `lang` (and `dir` when it differs from the page). The Arabic line keeps the 14px floor. Neither line is italic or tracked. Include one HTML example.
- [ ] **Step 2: Update `examples.ts`**, adding the stacked label example.
- [ ] **Step 3: Run the tests.** Expected: no bilingual-copy failures.
- [ ] **Step 4: Regenerate the Cursor rules.**
- [ ] **Step 5: Commit** `fix(skills): bilingual-copy defines its helpers and stacked labels`

### Task 5: gulf-formats

**Files:**
- Modify: `plugin/skills/dualkit-gulf-formats/SKILL.md`
- Modify: `packages/skills/test/examples.ts` (only if a renderable block is added)
- Regenerate: `cursor/rules/dualkit-gulf-formats.mdc`

- [ ] **Step 1: Verify the signs.** Check the UAE dirham sign's Unicode status and code point (unicode.org charts or the Unicode 17/18 delta, plus the CBUAE announcement), and check U+20C1 for the Saudi riyal. Put the URLs in the report.
- [ ] **Step 2: Edit the skill:**
  - Under the overview, add one line on coverage today: `@dualkit/format` parses UAE and Saudi phones and Emirates ID, and checks IBANs for AE, SA, BH, KW and QA. Other Gulf phones, national IDs and Omani IBANs are coming.
  - Money: give the verified code points as facts. For body text, use the code or the Arabic abbreviation (AED / د.إ, SAR / ر.س). Show a sign only with a font you ship that draws it, because most fonts show an empty box today.
  - Keep "Always pass `timeZone`".
- [ ] **Step 3: Run the full skills suite.** Expected: PASS, all green.
- [ ] **Step 4: Run the whole repo:** `npm run typecheck && npm test` from the root. Expected: PASS.
- [ ] **Step 5: Regenerate the Cursor rules.**
- [ ] **Step 6: Commit** `fix(skills): gulf-formats states coverage and verified currency signs`

### Task 6: Release surfaces and PR

**Files:**
- Modify: `plugin/.claude-plugin/plugin.json` (version `0.1.0` to `0.1.1`)
- Modify: `apps/site/lib/updates.ts` (new first `RELEASES` entry)
- Modify: `docs/superpowers/specs/2026-10-19-skill-fixes-design.md` (append any project 3 notes found)
- Check: `README.md`, `plugin/README.md`, site skill pages. Change only text that quotes skill lines that changed (`grep -rn` for the old phrases, e.g. "always LTR", "Inputs that are always").

- [ ] **Step 1: Bump the version.** Grep for other `0.1.0` references to the plugin version (marketplace JSON, site copy) and bump the ones that mean the plugin.
- [ ] **Step 2: Add the updates entry.** Use slug `skills-0-1-1`, date `2026-10-19` (or the merge date), version `Plugin 0.1.1`, tags `['Skills']`. Title and body should be plain and factual: the skills now teach plain CSS first, put the 14px Arabic floor in the snippet, cover punctuation and brackets, and every example is tested against the 20 rules. `shipped` lists the four skills, one line each. The release text is a deliverable, so write it in full sentences in Dualkit's voice, with no em dashes.
- [ ] **Step 3: Run the full repo checks:** root `npm run typecheck && npm test && npm run build`. Expected: PASS. The rules reader timing test now has a 6000 ms limit; if it still fails, rerun once.
- [ ] **Step 4: Commit** `chore(skills): release plugin 0.1.1`
- [ ] **Step 5: Push and open the PR** with a summary, the red-run evidence from Task 1, the verification URLs from Tasks 3 and 5, and a test plan. The body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Squash-merge once checks pass (Sam's standing rule).

### Task 7: Bench probe (controller, report-only)

- [ ] **Step 1:** After the merge, create a throwaway branch `probe/skill-fixes` from main. Restrict `packages/bench/models.json` to the models that built reliably (dots-3-note, laguna-s, nemotron-3-super, minimax-m3.1-flash). Restrict the prompts to payment-summary and order-history, the same way probe 39273995400 was set up: a throwaway branch that edits `models.json` and the prompt selection in `packages/bench` (read how prompts are chosen there). Dispatch with month `2099-05`.
- [ ] **Step 2:** `gh run download <id> --repo dualkit/dualkit`. Read the replies by hand. Compute the alone vs with-Dualkit fail rates for `type/arabic-size` and `bidi/punctuation-flip`.
- [ ] **Step 3:** Report the real numbers to Sam. If Dualkit is still worse on either rule, trace the cause to a skill line, if there is one, and add it to the project 4 notes. Delete the probe branch, locally and on the remote.
