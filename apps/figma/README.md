# Dualkit for Figma

A Figma plugin with two commands:

- **Check frame** reads the text layers in the selected frame and runs the Dualkit rules that work on Figma data. Findings are grouped by rule, each with its fix and a link to the pattern. Click a layer name to select it and zoom to it.
- **Fill Gulf samples** replaces the text of the selected layers with sample data: UAE and Saudi phone numbers, UAE and Saudi IBANs, Emirates IDs, amounts in AED, SAR and KWD, and Gregorian and Hijri dates. Phones, IBANs and Emirates IDs pass the validators in `@dualkit/format`. The same seed always gives the same samples.

The plugin has no network access (`allowedDomains: ["none"]`). The rules and the sample generator are bundled into it.

This package is private. It is not published to npm.

## Load it in Figma

You need the Figma desktop app.

1. From the repository root, install and build the packages it uses, then the plugin:

   ```sh
   npm install
   npm run build -w @dualkit/format && npm run build -w @dualkit/rules
   npm run build -w @dualkit/figma
   ```

   This writes `apps/figma/dist/code.js` and `apps/figma/dist/ui.html`.

2. In Figma desktop, open a design file, then choose **Plugins → Development → Import plugin from manifest…** and pick `apps/figma/manifest.json`.
3. Run it from **Plugins → Development → Dualkit**, then **Check frame** or **Fill Gulf samples**.

After a code change, run the build again and re-run the plugin. Figma reads the files in `dist/` each time it starts the plugin.

## What Check frame checks

The plugin turns each text layer into the same screen model the browser reader fills: one run per style segment, with its font family, weight, style, size, line height and letter-spacing, and one block per paragraph. It then runs these rules from `@dualkit/rules`, unchanged:

| Group | Rules |
| --- | --- |
| type | `type/arabic-font`, `type/arabic-leading`, `type/arabic-tracking`, `type/arabic-italic`, `type/arabic-size` |
| bidi | `bidi/unisolated-number`, `bidi/unisolated-latin`, `bidi/date-order`, `bidi/punctuation-flip` |
| content | `content/mixed-digits`, `content/placeholder-text`, `content/old-rial-sign`, `content/dirham-sign-with-code`, `content/latin-punctuation`, `content/currency-order` |
| layout | `layout/text-align-left` |

How Figma data maps to what the rules expect:

- **Fonts.** A family counts as an Arabic font when its name says so (for example "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Cairo") or when it is an Arabic system font such as Geeza Pro. Figma cannot tell the plugin which glyphs a font draws, so a brand font that covers Arabic under a non-Arabic name is flagged by `type/arabic-font`. Ignore that finding for such a font.
- **Direction.** Each paragraph takes its direction from its first strong letter, as a browser does for `dir="auto"`. Figma has no `<bdi>` and no `dir` attribute, so nothing in a layer counts as isolated. A phone number inside an Arabic sentence is flagged because it will show in reverse in the built page unless the developer isolates it. The fix sentences describe the code fix, so they read as notes for handoff.
- **Leading.** Line height in pixels or percent is converted to pixels. Auto line height is treated as unknown, so `type/arabic-leading` does not fire on it. The line count comes from the layer height divided by its line height.
- **Alignment.** `layout/text-align-left` fires on Arabic set Left in a fixed-width or fixed-size layer. An auto-width layer hugs its text, so its alignment does not show and is not flagged.

## What it does not check

The panel lists these under **Not checked in Figma**, with the reason for each:

- Rules that read HTML attributes: `content/missing-lang`, `content/missing-dir`, `content/lang-mismatch`, `content/label-language`, `layout/arabic-ltr-block`.
- Rules that read CSS or measure the built page: `layout/physical-spacing`, `layout/physical-inset`, `layout/mirrored-text`, `layout/clipped-text`, `type/arabic-broken-join`, `content/currency-sign-font`.
- `type/arabic-faux-bold`: Figma draws every style from a real font file.
- Rules that read form fields: `bidi/field-direction`, `bidi/field-placeholder`, `content/drops-arabic-digits`.
- Icon rules: `icons/arrow-points-forward`, `icons/not-mirrored`, `icons/mirrored-by-mistake`. This version does not read arrow direction from vectors.

If Figma returns a text segment with a mixed or missing font value, the plugin cannot check that text. It names those layers above the findings, so a clean result says when it is only partial.

A clean result in Figma does not mean the built screen is clean. Run `dualkit check` on the built page as well.

The adapter also records each text layer's parent auto-layout direction. No rule reads it yet.

## Fill Gulf samples

Select text layers, or a frame that holds them, then pick:

- **Sample:** "From each layer's name" picks a kind from names such as Phone, Mobile, IBAN, Emirates ID, Price, Total, Amount, Date or Hijri, in English or Arabic. A name that mentions Saudi, KSA or SAR gives the Saudi kind, and one that mentions KWD or Kuwait gives KWD. Layers whose names match nothing take the kinds in turn. You can also pick one kind for every layer.
- **Language:** English, Arabic with Western digits, or Arabic with Arabic-Indic digits.
- **Seed:** any whole number. The same seed and the same layers always give the same text.

Fonts are loaded before any text changes. A layer with a missing font is skipped and counted in the message.

Arabic Gregorian dates are written as 18/02/2026, because the Arabic month names in use differ across the region and a native co-author has not chosen them yet. Hijri dates use the Umm al-Qura calendar through `formatHijri`. There are no personal names: Arabic name spellings wait for a co-author to check them.

The samples are made up. An IBAN with a valid checksum can still match a real account by chance, so do not use these values outside mockups.

## Development

```sh
npm test -w @dualkit/figma           # unit tests
npm run coverage -w @dualkit/figma   # with coverage
npm run typecheck -w @dualkit/figma
```

The code is split so that most of it runs in tests:

- `src/snapshot.ts` copies live nodes into plain data. It runs on Figma's main thread, which has no `Intl` and no DOM.
- `src/adapter.ts` (`figmaToScreenModel`) turns that data into the rules' screen model.
- `src/coverage.ts` says which rules run in Figma and why the others do not. A test fails when a rule is added to `@dualkit/rules` and not placed here.
- `src/check.ts` runs the rules and groups the findings.
- `src/samples.ts` and `src/random.ts` make the samples.
- `src/code.ts` is the main thread: it sends snapshots, selects layers, loads fonts and sets text. `src/ui.ts` is the panel, and it runs the rules and the sample generator, because the plugin window has `Intl`.

The test fixtures in `test/fixtures.ts` build frame snapshots by hand. `test/code.test.ts` runs the bundled main thread against a fake `figma` object.

`assets/icon-128.png` is a 128 by 128 icon for the Community listing.
