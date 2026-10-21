# Precision pass: design

Status: scope approved by Sam on 20 Oct 2026 ("yes" to the fix list in the sweep report). Calls marked "Claude's call" are mine and open to change.

## Why

The usefulness sweep (docs/research/2026-10-20-usefulness-sweep.md) ran `dualkit lint` and `dualkit check` on 20 real products. Both find real bugs in 17 of 20, but most of what they report is fine: lint 16% of decided findings are real, check 56%. A team that tries Dualkit today reads mostly noise and stops. Test 2 of the study (an AI that follows the tool's advice) also needs trustworthy advice, or it will break working layouts.

## Goal

On the same 20 products, measured the same way:

- Lint precision at least 80%. Check precision at least 80%.
- Keep at least 90% of the real bugs the sweep found: at least 36 of 40 for lint, at least 62 of 69 for check.
- Lint reads Vue, Svelte and CSS-in-JS, so Chatwoot, Nextcloud and Twenty are covered.

If a rule cannot reach the bar after the changes below, it becomes a note (no score effect) rather than ship as a warning. Claude's call.

## Non-goals

- No new rules. The Arabic leading rule (54%) is left as is and parked.
- No changes to the Format, Starter or Skills packages.
- No getting around sites that block automated browsers.

## Lint changes

1. **Build-time flippers.** When the package that owns a file uses rtlcss, postcss-rtlcss, postcss-rtl, cssjanus or a stylis RTL plugin (in the nearest package.json dependencies or devDependencies, or `rtlcss` in a Gemfile or gemspec at the repo top), physical-css stays quiet on stylesheets in that package. It still runs on inline styles and Tailwind classes, which those tools do not touch. The lint summary says once that a flipper was found and physical-css was skipped for those files.
2. **dir-attribute-selector leaves the defaults.** 1 real of 65. It stays in the registry so an existing `ignore` entry does not error, but it no longer runs. Claude's call: remove it from the run rather than delete it, so configs stay valid.
3. **Generated and side files are skipped** for the physical rules:
   - Files that say they are generated (`@generated`, `DO NOT EDIT`, a `/*! tailwindcss v` banner) in their first 5 lines.
   - Paths with a segment named `examples`, `example`, `demo`, `demos`, `fixtures`, `__fixtures__`, `stories` or `storybook-static`.
   - Email templates: paths with a segment `mail`, `mails`, `email`, `emails`, `mailer` or `mailers`. Email clients have poor support for logical properties, so physical CSS there is correct.
   Skipped files are counted in the summary, not listed one by one.
4. **Deliberate geometry in JSX and HTML.** physical-tailwind and inline-style physical-css skip an element that:
   - sets its own `dir` attribute (its sides are fixed on purpose), or
   - is `aria-hidden="true"` (decorative), or
   - is positioned (`absolute` or `fixed`) with `pointer-events-none` (decorative overlay).
5. **Repos with no right-to-left support.** When nothing in the repo shows RTL support (no `dir="rtl"` or dir expression, no `rtl:` variant, no `:dir(rtl)`, `[dir=rtl]` or `.rtl` selector, no Arabic, Hebrew, Persian or Urdu locale file), its physical findings collapse into one note: "N sides are set left or right. This repo has no right-to-left support yet; start here." Claude's call: a team that has not started Arabic still learns the size of the job, without a wall of warnings. The signal is per repo, not per package, because monorepo packages without their own RTL code still render inside an RTL app.
6. **Coverage.**
   - `.vue` and `.svelte`: `<template>` (or the Svelte markup) is read as HTML, so class and style attributes are checked; `<style>` blocks as CSS or SCSS by their `lang`; `<script>` as JS or TS.
   - CSS in template literals: tagged templates `styled.x`…``, `styled(X)`…``, `css`…``, `createGlobalStyle`…`` and `injectGlobal`…`` are parsed as CSS with each `${…}` replaced by a placeholder value, so `margin-left: ${theme.spacing(2)}` is found.
   - Not in scope: `.erb`, `.hbs`, `.gjs`. Parked.

## Check changes

1. **Layout rules ignore sides that are already right-to-left.** physical-spacing, physical-inset and text-align-left skip a declaration when the stylesheet rule that sets it is scoped to right to left (`:dir(rtl)`, `[dir=rtl]` in any quoting, `.rtl`, `[lang^=ar]`, `:lang(ar)`), or when it comes from an inline style (set by script, such as carousels and tooltip libraries, which already compute for the direction). Claude's call on inline styles: 0 of the labelled inline cases were real.
2. **Only what a reader can see.** Every rule skips an element whose box, clipped by the viewport's horizontal range and by every ancestor that clips overflow, has no area left. This drops off-canvas menus and inactive carousel slides.
3. **text-align-left only when it shows.** Flag only a block whose content box is at least 4px wider than its text, so the text visibly sits on the left. Skip blocks where Arabic is under half the text.
4. **Tracking threshold scales with size.** type/arabic-tracking fires at 0.025em or more of the font size (0.4px at 16px), not 0.01px. Claude's call from the labels: 0.15px at 16px was never a visible defect; 0.5px at 9px was.
5. **Stable selectors.** Node ids prefer an element id, then a `data-testid`, then a class combination unique on the page, before falling back to the nth-of-type chain.

## Measurement

The sweep is rerun with frozen inputs:

- Lint on the same 10 repos at the commits in `~/Documents/Code/dualkit-sweep-data/repos.txt`.
- Check on the 10 pages replayed from recordings made on 21 Oct (`har/*.har.zip`), so before and after see the same page. The baseline is rerun on the recordings first, because the pages changed by a day.
- Each finding is matched to its label (lint: repo, file, line, rule; check: site, rule, selector or snippet). Labelled real findings that disappear count against recall. New findings (from Vue, Svelte and CSS-in-JS, or ones that were not sampled) are sampled up to 10 per product and labelled fresh with the same rubric.
- The data and harness live outside the repo in `~/Documents/Code/dualkit-sweep-data`, because they hold third-party code and pages. The report's numbers go into the repo.

## Release

- @dualkit/lint 0.2.0-beta.0, @dualkit/rules 0.3.0-beta.0, dualkit CLI 0.4.0-beta.0.
- Release surfaces: /updates entry with the before and after numbers, LINT.md and RULES.md, /docs, READMEs, the site test strip. The org profile only if a product line changes.
- Merge after checks pass, then publish through the Actions workflow.

## Left to the builder

File layout inside each package, the exact RTL-signal scan (bounded so a large monorepo still lints in seconds), and how the template-literal parser maps offsets back to source lines.
