# Cornerstone project 1: skill fixes (design)

Date: 19 Oct 2026. Project 1 of 6 in the cornerstone programme (see `docs/plans/2026-10-19-cornerstone-gap-map.md`).

## Intent

Bench rehearsal 2 showed the four Dualkit skills making some results worse. `type/arabic-size` failed in 73% of builds with Dualkit against 33% alone, and `bidi/punctuation-flip` went from 0% to 10%. The cause was the skills themselves. rtl-layout teaches Tailwind first, so builds load Tailwind and reach for `text-xs` and `text-[11px]`. The 14px floor appears only in a table row, and the snippet people copy sets no size. rtl-layout says it covers punctuation and then never does.

Sam's bar for this project is simple: **no mistakes.** A skill must never teach a wrong thing, contradict itself, or contradict Dualkit's own rules, format package or starter. Every claim must hold up against an official source or a real render.

## Goals

1. Every code example in the four skills, when rendered, passes all 20 `dualkit check` rules.
2. No skill contradicts another skill, the rules (`packages/rules`), `@dualkit/format` or the starter.
3. The specific bugs listed below are fixed.
4. Plain CSS leads in every skill. Tailwind appears only as a short footnote section.
5. A paired bench probe shows that, with Dualkit, `type/arabic-size` and `bidi/punctuation-flip` fail no more often than without it.

## Non-goals (later projects)

- New or changed rules, including the rule-side blind spots in the gap map (size-adjust, system-ui counting as Arabic, single-line leading). That is project 3.
- New formats or format API changes: other GCC phones, Oman IBAN, a required `timeZone`, a weekend helper. That is project 2. The skills only describe today's coverage honestly.
- Rewriting or expanding the skills into new topics. That is project 4.

## Anti-goals

- A skill that grows into a textbook. Keep the 900-word test limit; ~70-90 lines each is the target.
- Any claim marked [verify] in the gap map shipping without a checked source.
- Fixing the bench result by tuning prompts or numbers. Only the skills change.

## Decisions

### Plain CSS first, Tailwind as a footnote (Sam)

In every skill, the main text, tables and snippets use plain CSS and HTML attributes. rtl-layout and type-pairing each end with one short `## In Tailwind` section that holds the class mapping (`ms-4`, `pe-4`, `text-start`, `rtl:` variants and so on). That section must say outright that Arabic text never gets `text-xs` (12px) or an arbitrary size under 14px, with `text-sm` (14px) as the smallest allowed step. The logical-properties table drops its Tailwind column.

### The size floor becomes a mechanism, not a table row (Claude's call)

type-pairing teaches script-scoped size tokens, which match the starter's `script en/ar` token layer:

```css
:lang(ar) { --text-small: 14px; --text-body: 16px; letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }
.caption, .badge, label { font-size: var(--text-small); }
```

The snippet shows only Arabic-safe values. No 12px appears anywhere in it, because a model copying it onto an Arabic page would carry the 12px across (Claude's call). The starter already scopes its tokens with `:lang(ar)` and has a 14px Arabic `label` size, so token names follow the starter. The floor is also stated as a rule in prose: computed Arabic size is at least 14px for UI text and 16px for body. The prose names the places the bench caught small sizes: badges, field labels, nav labels, the ر.س / د.إ abbreviation, VAT notes and calendar sub-labels. It also says `size-adjust` does not count toward the floor, because the rule reads the computed font size.

### Inputs: no more "always LTR" (Claude's call)

- Fixed-format fields (phone, IBAN, Emirates ID, card, OTP) use `dir="ltr"`.
- Email and URL use `dir="ltr"`.
- Fields where people may type either script (names, search, free text, addresses) use `dir="auto"`.
- The label and the error stay in page direction.

Before writing this, the builder checks what the starter's Field and the `bidi/field-direction` fix text actually do. If one of them disagrees, the skill follows the rule and the starter, and the disagreement is reported back. It is not silently fixed in code (that is project 3 or 5).

### Punctuation section in rtl-layout

New section. It covers the failures the bench caught:

- Latin-led labels inside Arabic (`الgregorian:`): translate the label. If a Latin word must stay, isolate it.
- Bracketed codes in RTL (`(AED)`): put the brackets inside the isolate (`<bdi>(AED)</bdi>`), or use the Arabic abbreviation.
- A block whose last mark lands at the wrong end: give the block its own text's direction (`dir="auto"` for mixed user content).

Every example in this section is rendered in Chromium and checked both by eye (a screenshot in the PR) and by the rules.

### Bug list (from the gap map)

**type-pairing**
- Size floor (above).
- "-apple-system gets SF Arabic on Apple only": keep this advice. It is stricter than the rule, which accepts system stacks. Record the rule's leniency as a project 3 note, not a skill change.
- Add one line saying size-adjust is visual only.

**rtl-layout**
- Tailwind moves to the footnote. Verify `inset-s-0 (v4.3+)` against the Tailwind docs or changelog, and drop the claim if it can't be confirmed.
- Inputs (above). Punctuation (above).
- The `rtl:-scale-x-100` icon advice gets a plain-CSS form (`[dir="rtl"] .icon-directional { transform: scaleX(-1) }`).

**bilingual-copy**
- `formatCount()` is undefined. Replace it with a real call: `new Intl.NumberFormat('ar-AE-u-nu-latn').format(count)`, or a `@dualkit/format` export if one fits.
- "Keep the Latin full stop" is unexplained. Say that Arabic uses the same full stop character, and only the comma, semicolon and question mark change.
- Add secondary-language line styling for stacked bilingual labels: the second line gets its own `lang` and `dir`, the Arabic size floor, no italics and no tracking.

**gulf-formats**
- The description promises "the wider Gulf", but the body covers UAE and Saudi phones only and has no Oman IBAN. Keep the description, and add one honest line saying what `@dualkit/format` covers today and that the rest is coming.
- Dirham sign: verify its Unicode status against unicode.org and the CBUAE announcement, Re-check U+20C1 for the riyal the same way. Whatever the status, the advice for body text stays the code or the Arabic abbreviation (AED / د.إ, SAR / ر.س). The skill gives the code point as a fact, and says to show the sign only with a font you ship that draws it, because most fonts render it as an empty box today. An SVG fallback is project 2 or 4 work (Claude's call).
- `timeZone`: the advice stays "always pass it". The library making it required is project 2.

### Proof that skills can't regress (Claude's call)

Add tests in `packages/skills/test`:

1. **Render test.** Build one fixture page (Arabic, RTL) from the skills' good examples: the type-pairing CSS, the isolation examples, the punctuation examples and the input markup. Run it through the rules reader the same way `packages/rules/test/reader.test.ts` does, and require zero findings from all 20 rules. Good examples are the fenced code blocks outside the "Common mistakes" sections and outside "Instead of" / "never" table columns. The builder decides between pulling them from the markdown automatically and keeping a hand-maintained fixture with a test that each snippet's text still appears in the skill. Pulling is preferred if it stays simple.
2. **Ban scan.** Fenced code in the skills must not contain `text-xs`, `text-[` with a size under 14px, `tracking-` (except `tracking-normal`), or any px value under 14 for a font size, whether it's a declaration or a custom property. Banned classes appear only in prose as inline code ("never `text-xs` on Arabic"), never in fenced code, and that includes the Tailwind footnote (Claude's call).
3. **Function check.** The existing test covers `@dualkit/format` imports. Extend it so any function called in a snippet is either a `@dualkit/format` export or a standard global (catches `formatCount`).

Write each test first and watch it fail against today's skills. That reproduces the rehearsal 2 bug in a test.

### Bench probe

After the fixes, run a paired probe on a throwaway branch, the same way as probe 39273995400 (month 2099-05, payment-summary and order-history). Use the models that built reliably: dots-3-note, laguna-s, and whichever swapped-in models are merged by then. Read the replies by hand. Success means `type/arabic-size` and `bidi/punctuation-flip` with Dualkit are at or below the alone rate. Report the real numbers to Sam. Never adjust them. Delete the probe branch afterwards.

The probe is report-only and does not gate the merge (Sam delegated, Claude's call). With two or three models, one bad build can miss the bar by noise. The render test is the hard gate: every skill example passes all 20 rules. A probe miss is read by hand, and if the skills caused it, the cause goes into project 4.

### Release

Bump the plugin version (0.1.0 to 0.1.1), rebuild the Cursor rules (`packages/skills/scripts/build-cursor.mjs`), and add an `/updates` entry. The other release surfaces (READMEs, org profile) only change if they quote skill text that changed. One PR. Squash-merge once checks pass, per Sam's standing rule. Commit the gap map with this project.

## Left to the builder

- Final wording of every skill line, in Dualkit's existing voice (plain, short sentences, no em dashes).
- Whether the render test pulls snippets from the markdown or uses a fixture.
- Exact token names, following the starter.
- Which rules-reader helper to reuse for the render test (Playwright via `packages/rules/test/helpers/browser`).

## Notes for project 3 (found here, not fixed here)

- `ARABIC_FONT` accepts `system-ui`, `-apple-system` and `segoe ui` as Arabic fonts.
- The size rule ignores size-adjust, and it treats a lone ر.س like a paragraph.
- punctuation-flip checks only the last run in a block.
