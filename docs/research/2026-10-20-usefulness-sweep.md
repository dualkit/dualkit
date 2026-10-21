# Usefulness sweep, 20 Oct 2026

Test 1 of the usefulness study: run `dualkit lint` and `dualkit check` (CLI 0.3.0-beta.0) on 20 real products and label every sampled finding by hand. Pass bars were set before the run.

- At least 90% of decided findings are real bugs.
- At least 15 of the 20 products have a real bug we can show.

## Result

| Bar | Result | Pass |
|---|---|---|
| 90% of findings real | Lint 16% (40 of 252). Check 56% (69 of 123) | No |
| 15 of 20 products with a real bug | 17 of 20 | Yes |

The tools find real bugs in most products. They also flag too much that is fine, so a team trying them today would mostly read noise. Precision is the work before anything else.

## Method

- **Lint:** 10 open-source products that ship Arabic, shallow clones, `dualkit lint . --json`. Up to 30 findings per repo, sampled round-robin across rules (seed 1), 264 in all. Each labelled by reading the source and the project's RTL setup (overrides, build steps, how `dir` is set).
- **Check:** 10 live Arabic pages. Up to 20 findings per page, sampled the same way (seed 7), 171 in all. Each page reloaded, every sampled element cropped and outlined, computed styles and dir and lang chain recorded, then labelled from the crop.
- **Labels:** real, handled (the project already fixes it), intended (correct as built), unclear. Precision is real divided by real plus handled plus intended; unclear is left out and reported.
- **Swaps:** my.gov.sa, Emirates and noon block automated browsers, and stc returns 500 to headless Chromium. They were replaced by Al Rajhi Bank, du and dubizzle rather than getting around the blocks; stc was dropped. Careem and talabat were left out on purpose.

Raw data, samples, crops and per-repo notes: scratchpad `sweep/` (out, samples, csamples, labels).

## Lint

| Repo | Findings | Sampled | Real | Handled | Intended | Unclear |
|---|---|---|---|---|---|---|
| Discourse | 2,254 | 30 | 0 | 29 | 0 | 1 |
| Cal.com | 857 | 30 | 10 | 12 | 6 | 2 |
| Excalidraw | 165 | 30 | 6 | 15 | 7 | 2 |
| quran.com | 79 | 30 | 0 | 14 | 15 | 1 |
| Mastodon | 67 | 30 | 12 | 3 | 14 | 1 |
| Rocket.Chat | 61 | 30 | 8 | 0 | 21 | 1 |
| Nextcloud | 40 | 30 | 0 | 12 | 17 | 1 |
| Falah | 24 | 24 | 3 | 1 | 20 | 0 |
| Twenty | 17 | 17 | 0 | 6 | 9 | 2 |
| Chatwoot | 13 | 13 | 1 | 0 | 11 | 1 |

By rule: physical-tailwind 38%, physical-css 18%, dir-attribute-selector 2% (1 of 65), intl-digits 0 of 2.

Speed: 1 to 12 seconds per repo, up to 33,484 files.

### Why lint is noisy

1. **Build-time flipping.** Discourse runs rtlcss on every stylesheet (`lib/stylesheet/compiler.rb:81`), so all 2,249 physical-css findings are handled. Lint does not look for rtlcss, postcss-rtl, cssjanus or stylis RTL plugins.
2. **The `[dir]` selector note is wrong in practice.** 42 of 65 were the project's own working RTL fix. The one real case was Mastodon, where `[dir=rtl]` never matches because the app sets a class, not a `dir` attribute. That is a different rule.
3. **Generated and side files.** Compiled Tailwind output (cal.com `globals.css`), minified bundles, email templates the server mirrors (Nextcloud), demo apps under `examples/`, embed scripts for host pages (Chatwoot SDK).
4. **Intended geometry.** Decorative blobs, full-size overlays, tooltip and menu placement, map and chart positions, elements that set their own `dir`.

### What lint misses

- `.vue` files: Chatwoot has 1,242 (about 209 physical Tailwind uses in 107 files), Nextcloud 374.
- CSS in styled template literals: Twenty has about 1,095 physical lines in 504 `.ts` and `.tsx` files, against 26 in plain CSS.
- `.gjs`, `.erb` and `.hbs` templates.

### Best real bugs (all visible in Arabic)

- Mastodon: the settings toggle knob breaks, because the web app never sets `dir`, so `toggle.module.css:65` never matches. Also list markers overlap text, the emoji button covers the textarea, and step counters sit on the wrong side.
- Cal.com: `AppCard.tsx:221` badge stack stays on the right over the card text; `authorize-view.tsx:204` tick detached from its line.
- Excalidraw: export preview gap on the wrong side.
- Rocket.Chat livechat: select arrow overlaps the text.

These are upstream fixes we could send.

## Check

| Site | Score | Findings | Real | Handled | Intended | Unclear |
|---|---|---|---|---|---|---|
| Emirates NBD | 0 | 523 | 8 | 4 | 4 | 4 |
| Almosafer | 15 | 307 | 12 | 6 | 0 | 2 |
| u.ae | 45 | 182 | 11 | 3 | 0 | 6 |
| TAMM | 0 | 181 | 5 | 5 | 3 | 7 |
| du | 15 | 71 | 6 | 6 | 3 | 5 |
| Al Rajhi Bank | 35 | 66 | 11 | 5 | 1 | 3 |
| tabby | 30 | 52 | 4 | 0 | 4 | 12 |
| quran.com | 33 | 40 | 8 | 2 | 3 | 7 |
| Salla | 77 | 10 | 3 | 1 | 4 | 2 |
| dubizzle | 90 | 1 | 1 | 0 | 0 | 0 |

Real findings: 62 minor, 7 visible.

By rule:

| Rule | Real | Not real | Unclear | Verdict |
|---|---|---|---|---|
| type/arabic-size | 23 | 0 | 0 | Keep |
| content/label-language | 25 | 4 | 0 | Keep |
| content/mixed-digits | 4 | 1 | 0 | Keep |
| bidi/unisolated-number | 2 | 0 | 0 | Keep |
| type/arabic-leading | 7 | 6 | 11 | Tune |
| type/arabic-tracking | 4 | 0 | 19 | Threshold too low (0.15px flagged) |
| layout/physical-spacing | 0 | 14 | 6 | Broken |
| layout/physical-inset | 0 | 19 | 7 | Broken |
| layout/text-align-left | 0 | 5 | 0 | Broken |
| icons/not-mirrored | 0 | 0 | 3 | Unknown |

### Why check is noisy

1. **Layout rules judge the declaration, not the result.** Symmetric spacing, carousel gutters, uniform radii and icons already on the right side are flagged because a physical property was used.
2. **Hidden elements.** Off-canvas menus and inactive slides count as visible.
3. **Tracking threshold.** 0.15px on 16px text does not break joins.
4. **Unstable selectors.** 7 of 20 Al Rajhi selectors could not be found again on reload, which also weakens the report a user would read.

### Best real bugs

- tabby: `+1.2 مليون تقييم` renders as `1.2+ مليون تقييم`.
- Almosafer: `alt="[object Object]"` on card images.
- Al Rajhi: Arabic-Indic dates next to Western digits on news cards.
- Emirates NBD: 9px top navigation with letter-spacing and a faux bold.
- u.ae: 10.7px dates and poll question.

## What to fix first

Lint:
1. Detect build-time flippers (rtlcss, postcss-rtl, postcss-rtlcss, cssjanus, stylis RTL) and stay quiet on physical-css when one runs.
2. Take dir-attribute-selector out of the defaults. Replace it with a check that the project actually sets a `dir` attribute when it relies on `[dir]` selectors.
3. Skip generated and side files: compiled CSS, minified files, `examples/`, `demo/`, fixtures, email templates.
4. Read `.vue` and `.svelte` files, and CSS in styled and css template literals.

Check:
1. Judge layout by result: flag physical spacing or inset only when the box is asymmetric and lands on the reading-start side wrongly; skip symmetric cases.
2. Skip hidden, off-canvas and inactive-slide elements.
3. Raise the tracking threshold relative to font size.
4. Emit stable selectors.

Then rerun this exact sweep with the same samples and labels and publish the before and after.
