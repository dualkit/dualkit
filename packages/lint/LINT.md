# Dualkit lint rules

Generated from `src/rules`. Each rule reads source files, before anything renders.

## Source

<a id="source-physical-css"></a>
### `source/physical-css` Use logical CSS properties instead of left and right

**note.** A physical left or right property stays on the same side in Arabic, so the margin, padding, border, offset or alignment is on the wrong edge and the layout looks unbalanced.

**Fix:** Use the logical property, such as margin-inline-start, padding-inline-end, inset-inline-start or text-align: start, so the side follows the reading direction.

<a id="source-arabic-letter-spacing"></a>
### `source/arabic-letter-spacing` No letter-spacing on Arabic text

**error.** Letter-spacing pulls the joined Arabic letters apart, so words break into separate glyphs and become hard to read.

**Fix:** Set letter-spacing: 0 (or remove it) for Arabic selectors, and keep tracking on Latin text only.

<a id="source-dir-attribute-selector"></a>
### `source/dir-attribute-selector` Prefer :dir() to a [dir] attribute selector

**note.** A [dir] attribute selector misses content whose direction is inherited from a parent or set by dir=auto, so that content keeps the wrong styles.

**Fix:** Use the :dir(rtl) or :dir(ltr) pseudo-class, which matches the direction that applies to the element.

<a id="source-physical-tailwind"></a>
### `source/physical-tailwind` Use logical Tailwind classes instead of left and right

**note.** A physical class such as ml-4, pr-2, left-0, text-left or rounded-l-lg stays on the same side in Arabic, so the margin, padding, offset, alignment or corner is on the wrong edge.

**Fix:** Use the logical class, such as ms-4, pe-2, start-0 (inset-s-0 from Tailwind 4.2), text-start or rounded-s-lg, so the side follows the reading direction. Keep a physical class only under an rtl:, ltr: or side variant such as data-[side=left]:, or beside an rtl: or ltr: class that resets the same property, as in ml-4 rtl:ml-0 rtl:mr-4.

<a id="source-intl-digits"></a>
### `source/intl-digits` Digits left to the runtime

**note.** The default digits for Arabic locales come from the runtime's CLDR data. CLDR changed bare ar from Arabic-Indic to Latin digits between releases 45 and 46 (Node 18 prints Arabic-Indic, Node 20 and later print Latin), so the same code shows different digits on different machines. Regional tags differ from each other too: ar-SA and ar-EG default to Arabic-Indic, ar-AE and ar-MA to Latin.

**Fix:** Pin numberingSystem, or add a -u-nu- extension to the locale, set to latn or arab.

<a id="source-islamic-calendar"></a>
### `source/islamic-calendar` Bare islamic calendar

**warning.** CLDR ranks islamic-umalqura first among the Hijri calendars for Saudi Arabia, the UAE, Bahrain, Kuwait and Qatar, and the bare islamic calendar is a different calculation, so the same day can print a different Hijri date.

**Fix:** Use islamic-umalqura, as calendar: "islamic-umalqura" or -u-ca-islamic-umalqura in the locale.

<a id="source-hijri-time-zone"></a>
### `source/hijri-time-zone` Hijri date without a time zone

**warning.** Without timeZone, Intl uses the time zone of the machine it runs on, and the same instant can fall on a different Hijri day in another zone, so a server elsewhere can show yesterday's or tomorrow's date.

**Fix:** Pass a timeZone such as Asia/Riyadh or Asia/Dubai.

<a id="source-old-rial-sign"></a>
### `source/old-rial-sign` Old rial sign

**warning.** U+FDFC is the rial sign, a ligature of the Persian word ریال, and it is not the Saudi riyal sign: Unicode 17 added that as U+20C1. It is also a right-to-left letter (bidi class AL), not a currency sign (ET), so it behaves differently next to numbers.

**Fix:** Write the code SAR or ر.س. Use the Saudi riyal sign U+20C1 only where the font has it.

<a id="source-no-rtl-support"></a>
### `source/no-rtl-support` This repo has no right-to-left support yet

**note.** When nothing in the repo sets a direction, translates to Arabic or Hebrew, or uses an rtl: variant, hundreds of left and right findings would bury the one real decision: whether to support right-to-left at all.

**Fix:** Decide on right-to-left first: set dir on the root element from the active locale, then use logical properties and classes for new code. Add the rtl: variant or a dir rule where a side must stay fixed. Until then lint reports this one finding in place of the individual left and right ones.

## Known limits

- Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts, .tsx, .vue and .svelte files are read. Astro and MDX files are not. In Vue and Svelte files, only static class text is read, and style blocks in less, stylus or sass are skipped.
- A physical side is checked on its own. When it pairs with a side set elsewhere, such as an inline left value written by script, switching only the stylesheet side breaks right-to-left. Change both sides together, or suppress the line with a reason.
- CSS in JavaScript is read only from styled, css, createGlobalStyle and injectGlobal templates, not from keyframes, plain template strings or object styles.
- A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.
- A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.
- One inline `<script>` or `<style>` that does not parse, for example one holding template syntax, skips the whole HTML file.
- physical-css is a note, not a warning. A note is listed and counted in the summary but does not fail the run unless --fail-on note is set. On real repositories most physical-css findings were sides that were already handled or did not matter. physical-tailwind is a note too. In the precision measurement only 64% of its findings were real, 18 of 28 decided, and the rest were sides that were already handled or intended, so it is kept as a hint to check rather than a defect.
- physical-css skips left and right set to a negative offset of 999 or more, such as left: -9999px in a visually-hidden block, and a pair of sides set to the same value, such as left: 0 with right: 0.
- physical-css skips left: 50% or right: 50% when the same block translates 50% on x, the centring idiom, because it looks the same in both directions.
- physical-css skips a declaration when the same file has a :dir(), [dir] or :lang(ar) rule for the same selector, with the direction part removed, that resets the same property, directly or by a shorthand such as margin or inset-inline, as in .n { left: 0 } .n:dir(rtl) { left: auto; right: 0 }. An override that sets only the other side, such as margin-right for a base margin-left, still fires. An override in another file is not seen.
- arabic-letter-spacing skips a selector whose subject (its last part) is code, pre, kbd or samp, since that is usually Latin code inside an Arabic page.
- physical-css and arabic-letter-spacing read only the selectors in the file. A direction set by a parent selector in another file, or by a class, is not known.
- physical-tailwind reads classes only from class and className attributes, @apply, and the calls clsx, cn, cx, twMerge, twJoin, classnames, classNames, cva and tv. Any other string, such as a safelist in tailwind.config.js, is not read.
- physical-tailwind reads a class helper only when it is called by its bare name, so utils.cn(...) or a renamed import is not read.
- physical-tailwind does not guess a class built at runtime, such as ml-${n} or a string joined with +, and reads only the keys of a clsx object and the class values of a cva or tv config.
- physical-tailwind finds the Tailwind version in the nearest package.json that lists tailwindcss, walking up past the lint folder to the repository top (a folder holding .git), and never into the home folder. The installed copy wins when it satisfies the declared range. With only a range and nothing installed, the lowest version the range allows is used, and when the range allows releases both below and from 4.2, such as ^4, the fix for left-* and right-* names both start-* and inset-s-*. Below 3.3, or with no version found, it stays quiet. A catalog: or workspace: range with nothing installed gives no version, so the rule stays quiet there. A Tailwind prefix such as tw- is not known, so prefixed classes are not checked.
- physical-tailwind checks margin, padding, inset and scroll classes only with a Tailwind value: a number, a fraction, px, auto, full or an arbitrary value. A custom theme key such as ml-gutter, or a project class such as left-panel, is not checked.
- physical-tailwind skips a class under any variant holding rtl, ltr, left or right as a word, such as rtl:, group-[dir=rtl]: or data-[side=left]:, a matching pair that always applies together (in one string, or in unconditional parts of one attribute, class call or @apply), such as ml-2 mr-2 or left-0 right-0, left-1/2 or left-[50%] with a 50% x translate, the centring idiom, and an offscreen offset of 999 or more, such as -left-[9999px]. Arbitrary properties such as [margin-left:4px] are not checked.
- physical-tailwind skips a physical class when the same attribute, class call or @apply also holds an rtl: or ltr: class that resets the same physical property, as in ml-4 rtl:ml-0 rtl:mr-4 or text-left rtl:text-right. An override that sets only the other side, as in ml-2 rtl:mr-2, still fires, because both margins apply in right-to-left. It also skips both arms of a ternary whose test compares with the string left or right, such as side === 'left' ? 'left-0' : 'right-0', and cva or tv variant values under a left or right key.
- physical-tailwind skips the classes of an element that has dir="ltr" or aria-hidden="true", and the negative left and right offsets, such as -right-8, of an element that is absolute or fixed and pointer-events-none, a decorative overlay pushed past an edge. A positive offset such as right-3, or a margin, on that overlay is still reported. This applies in JSX and HTML. Inline style objects in JSX are not read, so they are not checked either way.
- source/no-rtl-support replaces every physical-css and physical-tailwind finding with one note when nothing in the repo shows right-to-left support. A signal is a dir attribute or property set to rtl, an rtl: variant, :dir(rtl), [dir=rtl], an .rtl class, an isRtl flag, a right-to-left build plugin such as rtlcss, or a file or folder named for an RTL locale (ar, he, fa, ur and similar) within six folders of the repository top. Ignore the rule to keep the individual findings.
- intl-digits, islamic-calendar and hijri-time-zone read only new Intl.NumberFormat and new Intl.DateTimeFormat (with or without new), and the methods toLocaleString, toLocaleDateString and toLocaleTimeString on any receiver. A destructured or aliased constructor, such as const { NumberFormat } = Intl, is not read.
- intl-digits fires only when the first locale is a string literal (or a template without expressions) that is ar or starts with ar-, in any case, or an array of string literals whose first item is one, because Intl uses the first locale it supports. A locale held in a variable, a spread, or an array with a non-literal item is quiet.
- intl-digits stays quiet for a date format whose options ask only for text fields (weekday, era, a long, short or narrow month, dayPeriod, timeZoneName) and no numeric field. A date format with no options still fires, since the default prints digits.
- The Intl rules go quiet when the options argument is anything but an object literal with plain keys: a variable, a spread, a computed key or a method. A numberingSystem, calendar or timeZone given any value, even a variable, counts as set.
- islamic-calendar and hijri-time-zone read the calendar option, or the -u-ca- extension of the first locale when the option is absent. A calendar held in a variable is not known. hijri-time-zone treats islamic, islamic-umalqura, islamic-civil, islamic-tbla and islamic-rgsa alike.
- old-rial-sign reads U+FDFC in string literals, template text, JSX text and attributes, HTML text and attributes, inline scripts, and CSS outside comments, including a CSS escape such as \FDFC. A sign built at runtime, such as String.fromCharCode(0xFDFC), a regular expression literal, or a sign in a file type that is not read, is not found.
- A file named directly on the command line is linted even when a .gitignore would skip it. Only directory walks honour .gitignore.
