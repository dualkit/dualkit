---
name: dualkit-type-pairing
description: Use when choosing or styling fonts for an interface that shows Arabic and English, including font stacks, Arabic looking too small or cramped, letter-spacing or uppercase labels, bold or italic Arabic, and line-height for Arabic text
---

# Arabic and English type pairing

## Overview

Arabic is cursive, has no case, and sits on a different vertical rhythm from Latin. At the same pixel size it usually reads smaller. Most Latin type habits (tracking, capitals, italics, tight leading) damage it.

## Choose the pair

Prefer one superfamily that was drawn for both scripts, so weights and rhythm match.

| Latin brand font | Arabic partner |
|---|---|
| IBM Plex Sans | IBM Plex Sans Arabic |
| Noto Sans | Noto Sans Arabic (UI) or Noto Kufi Arabic (display) |
| Readex Pro | Readex Pro covers both scripts |
| Inter, Geist (no Arabic glyphs) | IBM Plex Sans Arabic or Readex Pro |

All of these are free on Google Fonts. A `-apple-system` stack gets SF Arabic on Apple devices only, so name a web font for everyone else. Ship the real weights you use (400, 500, 600, 700). Never let the browser fake bold.

## Load Arabic as its own face

Scope the Arabic font with `unicode-range` and fix its size with `size-adjust`. Latin inside Arabic copy (AED, IBANs, brand names) then keeps the brand font, and Arabic matches the visual size of the Latin.

```css
@font-face {
  font-family: 'Brand';
  src: url('/fonts/ibm-plex-sans-arabic-500.woff2') format('woff2');
  font-weight: 500;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
  size-adjust: 112%;
}
/* then the Latin @font-face for 'Brand' with no unicode-range */
```

Tune `size-adjust` by eye against the Latin face at body size. Somewhere around 105% to 115% is typical.

## Rules for Arabic text

| Do | Instead of |
|---|---|
| `letter-spacing: 0` under `:lang(ar)` | Any `tracking-*`. It breaks or stretches the joins between letters |
| Sentence-case Latin source strings, with uppercase applied in CSS for Latin only | Capitals stored in the string (`'SECURE CHECKOUT'`) |
| Weight or colour for emphasis | Italic. Arabic has no true italic, so browsers fake a slant |
| Line-height about 1.6 to 1.8 for body text | Latin defaults of 1.4 to 1.5, which clip dots and marks |
| At least 14px for UI text, and 16px for body | 12px captions. Dots and diacritics blur |

```css
:lang(ar) { letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }
```

Use this plain CSS rule, even in a Tailwind project. A `rtl:` class on the root only sets inherited values, so any element with its own `tracking-*` or `leading-*` class still overrides it. Where an element sets tracking, add `rtl:tracking-normal` beside it.

## Numbers in type

Use `font-variant-numeric: tabular-nums` (`tabular-nums`) on amounts and tables in both scripts. Check that the Arabic face has tabular Arabic-Indic digits if you show them.

## Common mistakes

- A wide-tracked uppercase eyebrow label that keeps its tracking in Arabic.
- `font-family: 'Inter', sans-serif` for Arabic, which hands Arabic to a random system fallback.
- One line-height token for both scripts.
- Arabic headings at the same pixel size as the Latin ones, which look a size smaller.
