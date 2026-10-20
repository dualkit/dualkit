# Dualkit rules

Generated from `src/rules`. Each rule runs on the rendered page.

## Bidi

<a id="bidi-unisolated-number"></a>
### `bidi/unisolated-number` A number that will show in reverse

**error.** Inside right-to-left text the bidi algorithm reorders digit groups split by spaces, so 050 123 4567 shows as 4567 123 050.

**Fix:** Wrap the number in `<bdi>`, or give its element dir="ltr".

<a id="bidi-unisolated-latin"></a>
### `bidi/unisolated-latin` An email, link or code that will scramble

**error.** Punctuation inside emails, URLs and codes takes the direction of the Arabic around it, so dots and slashes jump to the wrong end.

**Fix:** Wrap it in `<bdi>`, or give its element dir="ltr".

<a id="bidi-punctuation-flip"></a>
### `bidi/punctuation-flip` Punctuation at the wrong end

**warning.** When a paragraph runs in the opposite direction to its words, the closing mark shows at the start: "Hello world!" becomes "!Hello world".

**Fix:** Give the block the direction of its own text, with dir="ltr", dir="rtl" or dir="auto".

<a id="bidi-field-direction"></a>
### `bidi/field-direction` A left-to-right field typed right to left

**warning.** Emails, phone numbers, links and codes typed into a right-to-left field jump around as each character lands.

**Fix:** Add dir="ltr" to the input, or dir="auto" if people may type Arabic too.

## Layout

<a id="layout-physical-spacing"></a>
### `layout/physical-spacing` Spacing that does not mirror

**warning.** margin-left and padding-right stay put when the layout flips, so gaps end up on the wrong side.

**Fix:** Use margin-inline-start, padding-inline-end and the other logical properties.

<a id="layout-physical-inset"></a>
### `layout/physical-inset` Position, float or border that does not mirror

**warning.** left, right, float and one-sided borders or corners stay on the same side when the layout flips.

**Fix:** Use inset-inline-start, float: inline-start, border-inline-start and border-start-start-radius.

<a id="layout-text-align-left"></a>
### `layout/text-align-left` Arabic text forced to the left

**error.** text-align: left pins right-to-left text to the wrong edge.

**Fix:** Use text-align: start.

<a id="layout-arabic-ltr-block"></a>
### `layout/arabic-ltr-block` Arabic laid out left to right

**error.** A mostly Arabic paragraph in a left-to-right box starts on the wrong side and puts its punctuation at the wrong end.

**Fix:** Set dir="rtl" on the page or the element, and lang="ar".

## Icons

<a id="icons-not-mirrored"></a>
### `icons/not-mirrored` A direction icon that points the wrong way

**warning.** Back, forward and chevron icons describe reading order, so in Arabic they must point the other way.

**Fix:** Mirror it in RTL with a :dir(rtl) { transform: scaleX(-1) } rule, or swap to the opposite icon.

<a id="icons-mirrored-by-mistake"></a>
### `icons/mirrored-by-mistake` An icon that must never mirror

**error.** Play, check marks, clocks and logos mean the same thing in every language, and flipped they look wrong.

**Fix:** Remove the flip from this icon.

## Type

<a id="type-arabic-leading"></a>
### `type/arabic-leading` Arabic lines set too tight

**warning.** Arabic has tall ascenders, deep descenders and dots, which clip or collide at Latin line heights.

**Fix:** Give Arabic body text a line height of about 1.6 to 1.8, for example :lang(ar) { line-height: 1.7 }.

<a id="type-arabic-tracking"></a>
### `type/arabic-tracking` Letter-spacing on Arabic

**error.** Arabic letters join, and letter-spacing pulls the joins apart.

**Fix:** Set letter-spacing: 0 on Arabic, for example :lang(ar) { letter-spacing: 0 }.

<a id="type-arabic-italic"></a>
### `type/arabic-italic` Slanted Arabic

**warning.** Arabic has no italic, so the browser slants the letters, which reads as broken.

**Fix:** Set font-style: normal on Arabic and use weight or colour for emphasis.

<a id="type-arabic-font"></a>
### `type/arabic-font` No Arabic font in the stack

**warning.** With no Arabic face listed, every device falls back to its own font, so the design looks different everywhere.

**Fix:** Load an Arabic family with @font-face or a font link and name it in the stack, for example "IBM Plex Sans Arabic".

<a id="type-arabic-size"></a>
### `type/arabic-size` Arabic set too small

**warning.** At the same pixel size Arabic reads smaller than Latin, and its dots blur below 14px.

**Fix:** Keep Arabic UI text at 14px or more, and body text at 16px.

<a id="type-arabic-faux-bold"></a>
### `type/arabic-faux-bold` Arabic bold is faked

**warning.** When no bold face is loaded the browser smears the regular one to fake bold, which blurs Arabic joins and dots.

**Fix:** Load a real bold face for the Arabic family, for example an @font-face at font-weight 700.

## Content

<a id="content-missing-lang"></a>
### `content/missing-lang` No page language

**error.** Without lang on `<html>`, screen readers guess the language and browsers pick the wrong fonts and line breaks.

**Fix:** Add lang="ar" or lang="en" to `<html>`.

<a id="content-missing-dir"></a>
### `content/missing-dir` An Arabic page without dir="rtl"

**error.** The page is mostly Arabic but the document still runs left to right, so the whole layout starts on the wrong side.

**Fix:** Set dir="rtl" on `<html>` whenever lang is Arabic.

<a id="content-lang-mismatch"></a>
### `content/lang-mismatch` Arabic tagged as another language

**warning.** Screen readers read this Arabic with the wrong voice.

**Fix:** Put lang="ar" on the element that holds the Arabic.

<a id="content-mixed-digits"></a>
### `content/mixed-digits` Two digit systems on one screen

**warning.** Mixing 50 and ٥٠ in the same Arabic interface looks unfinished and makes numbers harder to compare.

**Fix:** Pick one digit system for the product and format every number with it.

<a id="content-placeholder-text"></a>
### `content/placeholder-text` Placeholder text left in

**warning.** Lorem ipsum, in Latin or Arabic, hides how real copy will wrap and reads as unfinished.

**Fix:** Replace it with real copy, or realistic Gulf sample data.
