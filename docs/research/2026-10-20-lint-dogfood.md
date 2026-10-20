# Lint 0.1.0-beta.0 dogfood

Run on 20 Oct 2026 from the repo root with `node packages/cli/dist/cli.js lint . --json`, after building format, rules, lint and the CLI. All 8 source rules ran.

- Files read: 410. Skipped: 1.
- Findings before: 93. Findings after: 4, all in test fixtures listed below.
- No Tailwind in the repo. No package.json lists tailwindcss, apps/site included, so physical-tailwind had no version and stayed quiet, as LINT.md says it should.
- The Intl rules (intl-digits, islamic-calendar, hijri-time-zone) and arabic-letter-spacing found nothing.

## Findings by rule and folder

| Rule | Folder | Count | Verdict |
|---|---|---|---|
| physical-css | apps/site/app | 5 | 2 real, 3 deliberate |
| physical-css | apps/site/components | 42 | 11 real, 31 deliberate |
| dir-attribute-selector | apps/site/app | 1 | real |
| dir-attribute-selector | apps/site/components | 1 | deliberate |
| physical-css | design/prototypes/hero3 | 24 | deliberate |
| dir-attribute-selector | design/prototypes/hero3 | 1 | deliberate |
| physical-css | design/prototype/motion.src.html | 3 | deliberate |
| dir-attribute-selector | design/prototype/motion.src.html | 5 | deliberate |
| physical-css | packages/bench/test/fixtures | 2 | deliberate (fixture) |
| physical-css | packages/cli/test/fixtures | 2 | deliberate (fixture) |
| old-rial-sign | packages/lint/src and test | 2 | deliberate |
| old-rial-sign | packages/rules/src and test | 5 | deliberate |

Totals: 14 real bugs, 79 deliberate, 0 false positives.

## Real bugs (fixed in 77d7008 `fix(site): logical sides for page chrome found by dualkit lint`)

The site is left to right today (`<html dir="ltr">`), so none of these moved anything on screen. They are page chrome that would sit on the wrong side in right-to-left, and the logical property is identical in left to right.

- `border-left` on the cell dividers: how.css lines 7 and 15, kit.css 50, mirror.css 13, numbers.css 3 and 14, works.css 9, 37 and 38. Now `border-inline-start`.
- region-video.css 8 and 21, the play chip on the video: `left` to `inset-inline-start`.
- globals.css 146, the halftone hint: `left` to `inset-inline-start`.
- v3.css 243, the check preview meter fill: `left: 0` to `inset-inline-start: 0`.
- globals.css 293, `[dir="rtl"] .fb-panel` (dir-attribute-selector): now `.fb-panel:dir(rtl)`, which also follows a direction that is inherited or set by `dir="auto"`.

## Deliberate, suppressed with a reason

Per line, with `dualkit-disable-next-line <rule> -- <reason>`:

- globals.css 244: `.win { left: auto !important }` under 960px undoes the physical `left: 50%` centring and the drag position. A logical reset would leave `left: 50%` in place in right-to-left.
- globals.css 373: the bench score track marks move by `translateX`, so they start from the physical left.
- v3.css 257, bench-teaser.css 18 and 20: `margin-left: -5px` centres a pin on the `left: %` that the code sets inline on a score axis. Changing only the margin would break the pin in right-to-left. `margin-left: 0` resets it.
- how.css 39: the dot rides an SVG `offset-path`, drawn in physical coordinates.
- packages/lint/src/rules/rial.ts 8, packages/rules/src/rules/content.ts 77 and 78: the sign the rule looks for, and the check message that names it.
- packages/lint/test/rules/rial.test.ts 7, packages/rules/test/fixtures.ts 64, packages/rules/test/rules/content.test.ts 74 and 75: test inputs and an asserted message.

Whole file, with `dualkit-disable <rules> -- <reason>`:

- apps/site/components/v3/hero.css (physical-css x20 hits on 18 lines, dir-attribute-selector x1): the hero story is a scripted scene. A camera and its layers sit in physical coordinates, the pins are named left and right, and `.panel[dir='ltr']` selects the panel whose dir attribute the story engine flips to show the page without Dualkit and then with it. Sample: line 32 `.v3-story .cam { left: 0 }`, line 108 `.panel[dir='ltr'] .ph .chip`.
- apps/site/components/v3/region.css (physical-css x8): pins on the Gulf map sit on geographic positions, and a map does not mirror. Sample: line 9 `.v3-region-pin { left: var(--dx) }`.
- design/prototypes/hero3/index.html (physical-css x24, dir-attribute-selector x1): the frozen prototype for the hero above, same reasons. The comment sits after the doctype so the page stays in standards mode.
- design/prototype/motion.src.html (physical-css x3, dir-attribute-selector x5): a motion study, not shipped. Sample: line 116 `.pay[dir="rtl"] .back svg`.

## Deliberate, listed here (fixtures that must keep their bugs)

A directive in these would change what the tests feed in, so they stay as they are.

- packages/cli/test/fixtures/lint/physical.css line 2, `margin-left: 8px`: the CLI lint tests expect this finding.
- packages/cli/test/fixtures/page.html line 3, `margin-left: 16px`: the check fixture page.
- packages/bench/test/fixtures/buggy.html line 4, `margin-left: 24px` and `text-align: left`: the bench's buggy page.

## Skipped files

- design/type-options.html, skipped as minified. It is a 76-line design reference from the v2 rebrand with a 26,204-character line of embedded data, not shipped source. Skipping it is right.

No source file in packages or apps failed to parse.

## Notes for later

Three deliberate cases share a shape the rule cannot see: a physical side that pairs with a physical value set somewhere else (an inline `left: %` from code, a `translateX`, or a `left: 50%` centring in another block). The rule text is still true, the property is tied to one side, so these are not false positives. A future rule note could say that a physical value which pairs with an inline style from code should stay physical, or be moved together with that style.
