# Cornerstone project 3: more rules, and a source linter (design)

Date: 20 Oct 2026. Project 3 of 6 in the cornerstone programme (`docs/plans/2026-10-19-cornerstone-gap-map.md`).

Status: written by Claude on 20 Oct after Sam said "continue". Every decision below is Claude's call unless marked otherwise. Nothing merges until Sam approves this design.

## Intent

`dualkit check` runs 20 rules on a rendered page. The bench showed nine of them never fail and that several of the others have blind spots, so a page can score well and still ship broken Arabic. This project makes the check catch more of what really goes wrong, and adds a second tool, `dualkit lint`, that finds the same family of bugs in source code before anything renders, so an agent or a reviewer gets the warning in the file it is editing.

Sam's bar carries over: **no mistakes.** A rule that fires on correct work teaches people to ignore Dualkit, which is worse than a missing rule. So the target is "about 40", not exactly 40: a candidate rule that fails its proof is dropped and recorded, never shipped weak to hit a number.

## Goals

1. Close the blind spots in the existing rules that the gap map lists.
2. Add new rendered rules for bugs that are common in Gulf interfaces and provable in Chromium.
3. Ship `dualkit lint`: source rules over CSS, SCSS, HTML, JS, TS, JSX and TSX, with the same finding shape, docs links and config as `dualkit check`.
4. Every rule, old or new, passes the proof standard below.
5. The 1 Nov bench run uses the new rendered rule set.

## Non-goals

- ESLint or stylelint plugins. The linter is built so they can wrap it later; they are not part of this project.
- Vue, Svelte, Astro and MDX files. CSS-in-JS template strings (styled-components, emotion) are skipped too.
- A Figma reader. The model stays Figma-ready, as it is today.
- Running the source linter in the bench. That is project 6.
- National IDs, VAT and e-invoicing checks. Those depend on format work that is not verified yet.

## Anti-goals

- A false positive on correct, idiomatic code. Each rule has a near-miss negative test for the most likely way it could fire wrongly.
- Rules that encode taste (quote styles, justified text, date order). Every rule names a real failure a person would see or hear.
- Regex over JavaScript. Source rules read a real parse tree, so a match inside a comment or an unrelated string never fires.

## The proof standard (applies to every rule)

1. A fixture that fires, and at least two that do not, one of them the nearest correct pattern.
2. Any claim about rendering (what reorders, what clips, what breaks a join) is measured in Chromium in `test/verify.test.ts`, the way `punctuation-flip` is today. If the probe disagrees with the rule, the rule changes or is dropped.
3. Any fact (a Unicode code point, a Tailwind class name, a central bank guideline) is cited in `docs/research/2026-10-20-rules-facts.md` with its source and a confidence. Only VERIFIED facts back a rule.
4. Dogfood: the rendered rules run on every dualkit.dev page and the starter's pages, and the linter runs on this repo. Each finding is either a real bug (fixed in its own commit) or a false positive (the rule is fixed). Zero unexplained findings at merge.

## Part A: rendered rules (PR 1)

### Blind-spot fixes in existing rules (same ids)

| Rule | Today | Change |
|---|---|---|
| `bidi/unisolated-latin` | `#A-10293` (one capital) escapes | Codes with one or more capitals plus digits count. |
| `bidi/unisolated-number` | Arabic-Indic digit groups are skipped | `٠٥٠ ١٢٣ ٤٥٦٧` counts too, once a probe shows it reorders. |
| `type/arabic-font` | Any family name passes, and `system-ui`, `-apple-system` and `Segoe UI` count as Arabic | A stack passes only if it has an Arabic webfont the page actually loaded (a `FontFace` with status `loaded` whose unicode-range covers U+0600 to U+06FF) or a family on a short list of system fonts that ship Arabic, with the list sourced. The message says which case failed: no Arabic family named, or one named but never loaded. |
| `type/arabic-size` | Ignores `size-adjust` | When the run's first family is a loaded face with `size-adjust`, the rule judges the adjusted size. |
| `bidi/punctuation-flip` | Checks only the last run of a block | Extended only to cases a Chromium probe proves flip. If none can be proved, the limit is documented in RULES.md instead. |
| `icons/not-mirrored`, `icons/mirrored-by-mistake` | Icons are found by class name only | Also by `aria-label`, `title` or `data-icon` naming a direction (back, next, arrow, chevron). An unnamed inline SVG stays out of reach, and RULES.md says so. |

### New rendered rules

| Id | Severity | Catches | Proof |
|---|---|---|---|
| `content/old-rial-sign` | warning | U+FDFC (﷼) on the page. It is the Iranian rial ligature, not the Saudi riyal sign. | Fact already VERIFIED in the GCC research. |
| `content/currency-sign-font` | warning | U+20C1, U+20C3 or U+20C4 drawn with no loaded webfont that covers it. Most devices have no font with these signs yet, so they show as a box. | The same advice the gulf-formats skill gives. |
| `content/dirham-sign-with-code` | note | The dirham sign next to "AED", "Dh" or "درهم" in the same run. | Ships only if the CBUAE guideline PDF says this. Otherwise dropped. |
| `content/label-language` | warning | `aria-label`, `alt` or `title` in a different script from the element's `lang`, so a screen reader reads English in an Arabic voice. | The reader is extended to read these attributes. |
| `bidi/field-placeholder` | warning | An Arabic placeholder in a field forced to `dir="ltr"` (email, phone, IBAN). It renders left-aligned and its punctuation flips. | Chromium probe. The fix text gives the `:placeholder-shown` pattern. |
| `layout/mirrored-text` | error | Text inside an element flipped with `scaleX(-1)` or `rotateY(180deg)`, usually a layout flipped wholesale for RTL. | Reuses the icon reader's mirror test. |
| `layout/clipped-text` | warning | Text cut off by an `overflow: hidden` or `clip` box: wider than its box (Arabic labels often run longer than English) or taller (dots clipped by a tight line height). Ellipsis truncation that the author set on purpose (`text-overflow: ellipsis`) does not count. | Chromium probe for both directions. This also covers the single-line leading case the gap map lists. |
| `type/arabic-broken-join` | error | An Arabic word split across elements in a way that breaks the letter joins: the second part in an inline-block or flex item, or in a different font family. | Ships only for the cases a Chromium probe shows break. A colour change alone keeps the join in Chromium and must not fire. |
| `type/arabic-faux-bold` | warning | Arabic at weight 600 or more in a webfont family that has no loaded face at or above that weight, so the browser fakes the bold and smears the dots. | Uses the `FontFace` list. |

That is 9 candidates, so Part A ends with up to 29 rules.

### Reader changes

`ScreenModel` gains what the new rules need and nothing else: loaded font faces (family, weight range, unicode-range, size-adjust, status), per-element label attributes, field placeholders, clip facts (scroll and client sizes, overflow, text-overflow) and the mirror flag for text containers. The reader stays one in-page script with no Node dependency.

## Part B: `dualkit lint` (PR 2)

### Shape

- A new package, `@dualkit/lint`, with the engine and source rules. The `dualkit` CLI gets `dualkit lint [paths…]` (default: the current folder, honouring `.gitignore`). The GitHub Action gets a `command` input (`check` or `lint`).
- Findings use the same `Finding` shape as `@dualkit/rules`, with `node` replaced by a file, line and column. Terminal output and `--json` match `check`. Exit code 1 when anything at or above `--fail-on` (default `error`) is found, 2 for a usage error, as `check` does.
- Parsers: `postcss` with `postcss-scss` for CSS and SCSS, `@babel/parser` for JS, TS, JSX and TSX, `parse5` for HTML (its inline `<style>` and `<script>` go through the other two).
- Suppression: `// dualkit-disable-next-line <rule-id>` and `/* dualkit-disable <rule-id> */` for the file. `dualkit.config.json` `ignore` accepts lint rule ids too.

### Source rules

| Id | Severity | Catches |
|---|---|---|
| `source/physical-css` | warning | `margin-left`, `padding-right`, `left`, `right`, `border-left`, physical corner radii, `float: left` and `text-align: left|right` in CSS and SCSS. The fix names the logical property. |
| `source/physical-tailwind` | warning | `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l`, `rounded-r`, `border-l`, `border-r`, `float-left` and their `scroll-` forms, in `class`, `className`, `@apply`, and string arguments to `clsx`, `cn`, `cva`, `twMerge` and `classnames`. Classes with an `rtl:` or `ltr:` variant are skipped, because those are deliberate. Each replacement is checked against the Tailwind docs, with its minimum version. |
| `source/intl-digits` | warning | `Intl.NumberFormat`, `Intl.DateTimeFormat`, `toLocaleString`, `toLocaleDateString` and `toLocaleTimeString` with an Arabic locale but no `-u-nu-` and no `numberingSystem`. CLDR has changed the default digits for Arabic locales between releases, so the digits change under you. |
| `source/islamic-calendar` | warning | `calendar: 'islamic'` or `-u-ca-islamic` with no variant. The fix names `islamic-umalqura`, the calendar Saudi Arabia uses. |
| `source/hijri-time-zone` | warning | An Islamic-calendar `Intl.DateTimeFormat` with no `timeZone`, so the day follows the server's clock. |
| `source/old-rial-sign` | warning | U+FDFC in any source file, written raw, as `﷼`, or as `&#xFDFC;`. |
| `source/arabic-letter-spacing` | error | A CSS rule whose selector targets Arabic (`:lang(ar)`, `[lang="ar"]`, `:dir(rtl)`, `[dir="rtl"]`) and sets a non-zero `letter-spacing`. |
| `source/dir-attribute-selector` | note | `[dir="rtl"]` and `[dir="ltr"]` used as direction selectors. They miss `dir="auto"` and nested islands; `:dir()` does not. |

That is 8 source rules. With Part A, the total is up to 37. If every candidate passes its proof, the site says "37 rules". If some are dropped, it says the real number.

## Bench

The 1 Nov run uses the Part A rule set. Part A must merge by 30 Oct so the run is not rushed. The bench's "rules passed" denominator grows with it. The 1 Nov run is the first real one, so it becomes the baseline. The rehearsal numbers are not compared against it.

## Release

- `@dualkit/rules` 0.2.0-beta.0 (Part A). `dualkit` CLI 0.2.0-beta.0 with Part A, then 0.3.0-beta.0 with `lint`. `@dualkit/lint` 0.1.0-beta.0 is published for the first time.
- Every place that says "20 rules" says the new number: the CLI README, the site's home copy, the /updates entries for new releases (old entries stay as written), the roadmap, and the tests that pin the count.
- RULES.md is regenerated; a new LINT.md is generated the same way. The /docs page gets a lint section.
- The org profile and the root README change if they quote the count.
- One /updates entry per PR.

## Calls settled after the builder check (Claude's)

- **Who the linter is for.** `dualkit lint` assumes the project ships right-to-left, because running it says so. It does not try to detect that. Symmetric pairs are correct in both directions and never fire: `left: 0; right: 0`, `margin-left: auto; margin-right: auto`, and `mx-`, `px-` and `inset-x-` in Tailwind.
- **Tailwind versions.** The rule reads the installed `tailwindcss` version from the nearest `package.json`. Below 3.3, where the logical classes do not exist, it stays quiet. A replacement that needs a later version than the one installed (`inset-s-` needs 4.2) is left out of the fix text.
- **Finding types.** `@dualkit/lint` defines its own `LintFinding` (file, line, column) and imports `Severity` and the docs URL helper from `@dualkit/rules`. The rules `Finding` type does not change, so PR 1 breaks nothing downstream.
- **Fonts.** Nothing waits for webfonts today. The CLI and the bench wait for `document.fonts.ready` before reading the page, and the font rules judge a face by its status after that wait. That change is in PR 1.
- **Dogfood targets.** dualkit.dev built and served locally (`next build`, `next start`), every route. The starter is checked through its components on the site's pages; it has no pages of its own.
- **Dropped candidates.** The builder drops a rule that fails its proof, records why in the ledger, and lists every drop in the PR body. Sam sees them at review; nothing waits on him mid-build.
- **Publishing.** Releases go out through the Publish workflow on GitHub Actions after each merge, as format 0.2 did. The workflow gains `lint` as a package option. Copy changes such as the rule count go in the PRs themselves.

## Left to the builder

- Exact message strings, in the existing voice.
- How the lint engine walks files, as long as it honours `.gitignore` and skips `node_modules` and `dist`.
- Whether a dropped candidate gets a line in RULES.md under "known limits". It should, if a user is likely to expect it.
