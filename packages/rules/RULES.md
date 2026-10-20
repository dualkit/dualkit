# Dualkit rules

Generated from `src/rules`. Each rule runs on the rendered page.

## Bidi

<a id="bidi-unisolated-number"></a>
### `bidi/unisolated-number` A number that will show in reverse

**error.** Inside right-to-left text the bidi algorithm reorders digit groups split by spaces and moves a leading # or +, so 050 123 4567 shows as 4567 123 050.

**Fix:** Wrap the number in `<bdi>`, or give its element dir="ltr".

<a id="bidi-unisolated-latin"></a>
### `bidi/unisolated-latin` An email, link or code that will scramble

**error.** A leading #, a trailing slash or a digit beside an email, link or code takes the direction of the Arabic around it, so it jumps to the wrong end.

**Fix:** Wrap it in `<bdi>`, or give its element dir="ltr".

<a id="bidi-punctuation-flip"></a>
### `bidi/punctuation-flip` Punctuation at the wrong end

**warning.** When a paragraph runs in the opposite direction to its words, the closing mark shows at the start: "Hello world!" becomes "!Hello world".

**Fix:** Give the block the direction of its own text, with dir="ltr", dir="rtl" or dir="auto".

<a id="bidi-field-direction"></a>
### `bidi/field-direction` A left-to-right field typed right to left

**warning.** Emails, phone numbers, links and codes typed into a right-to-left field jump around as each character lands.

**Fix:** Add dir="ltr" to the input, or dir="auto" if people may type Arabic too.

<a id="bidi-field-placeholder"></a>
### `bidi/field-placeholder` An Arabic hint on the wrong side of the field

**warning.** A field that runs left to right paints its placeholder at the left edge, so an Arabic hint sits where Arabic readers look last.

**Fix:** Keep dir="ltr" for what people type, and right-align the Arabic hint with input:placeholder-shown { direction: rtl }.

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

<a id="layout-mirrored-text"></a>
### `layout/mirrored-text` Text flipped with the layout

**error.** A scaleX(-1) on a container mirrors its letters too, so Arabic reads backwards. Only icons and artwork should flip.

**Fix:** Flip the icon or image alone, and leave the text outside the transform.

<a id="layout-clipped-text"></a>
### `layout/clipped-text` Arabic text cut off by its box

**warning.** A fixed-size box with overflow hidden cuts off Arabic text that runs long or sits tall, such as a label wider than its button or dots below a tight line.

**Fix:** Let the box grow with min-width or min-height, or add text-overflow: ellipsis if shortening is intended.

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

<a id="type-arabic-broken-join"></a>
### `type/arabic-broken-join` Arabic word split by a box

**error.** An inline-block or inline-flex box, and on some platforms a change of font, shapes the text on its own, so the letters on either side stop joining and the word reads as two.

**Fix:** Keep the word in one inline element, or style the whole word. Colour, bold and padding on an inline span keep the join, but a font change can break it.

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

<a id="content-old-rial-sign"></a>
### `content/old-rial-sign` The old rial ligature used as a riyal sign

**warning.** U+FDFC is the Persian word for rial drawn as one glyph, so it reads as a different currency mark and many fonts draw it differently or not at all.

**Fix:** Use ⃁ (U+20C1) for the Saudi riyal with a font that has it, or write ر.س or SAR.

<a id="content-currency-sign-font"></a>
### `content/currency-sign-font` A new currency sign no loaded font draws

**warning.** The Saudi riyal, UAE dirham and Omani rial signs are new to Unicode, so a font without them draws a blank box, or whatever the visitor's device happens to have.

**Fix:** Load a font that has the sign, or write the currency code instead.

<a id="content-dirham-sign-with-code"></a>
### `content/dirham-sign-with-code` The dirham sign next to the code AED

**note.** The Central Bank of the UAE guideline says to use the dirham sign or the code AED, never both, because the price then names the currency twice.

**Fix:** Keep the sign or the code AED, not both.

<a id="content-label-language"></a>
### `content/label-language` A label in a different language from its element

**note.** The HTML lang attribute applies to the element's text attributes too, so the label is declared to be in the element's language, and screen readers that switch voice by language read it with the wrong pronunciation.

**Fix:** Put lang on the element to match the label, or write the label in the language of the element.

## Known limits

- A closing mark in the middle of a line, such as the ! in "Hello world! مرحبا", is not checked. Only the end of a paragraph, or of a line that a `<br>` closes on its own, is.
- Emails, links and codes are flagged only where Chromium paints them differently once isolated: with a leading #, a trailing slash, or a Western digit beside them. In the middle of a sentence, at either end of a block, or before a full stop or bracket they paint the same, so they are not flagged.
- An email, link or code beside a Latin word is not flagged: isolating it only splits one left-to-right phrase that already reads in order.
- Groups of Arabic-Indic digits paint the same with or without `<bdi>`, so they are not flagged.
- A new currency sign counts as drawn when a loaded font declares it in an explicit unicode-range, or when the page's own webfont draws it at a different width from both its missing-glyph box and plain sans-serif. A font that has the sign at exactly the width of the system fallback glyph would be missed.
- Only the pairing of the dirham sign with AED is flagged, because that is the one the Central Bank of the UAE guideline forbids. Dh and the Arabic word are not in the guideline, so they are left alone.
- A label is flagged only when it is wholly in the other script, such as a Latin sentence on an Arabic page. Labels that mix scripts, and one-word names like Visa, are left alone.
- An icon is named from its data attribute, sprite reference, class, glyph text, aria-label, title, SVG `<title>`, or the aria-label of the button or link around it when the icon is the only content of that control. A fully unnamed SVG that is not alone in a labelled control is not recognised, so its direction is not checked. An unnamed icon that is the only content of a control takes the name of that control, so a non-directional glyph in a control named with a direction word is read as directional.
- Text is checked for a horizontal flip on its own element and up to 4 ancestors. A flip applied further up, or by a filter or animation, is not seen.
- A clipped box is found when it scrolls and its own text, measured by the painted text boxes, reaches past its padding box. A box that scrolls only for an oversized image is not flagged. Only boxes whose cut-off text contains Arabic are flagged. Ink that sticks out of a text box that still fits its line, such as a dot just under a tight line, is not measured.
- Masks that reveal part of a strip by transform (odometers, rolling labels) look like clipped text.
