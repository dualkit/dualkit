# Dualkit lint rules

Generated from `src/rules`. Each rule reads source files, before anything renders.

## Source

<a id="source-physical-css"></a>
### `source/physical-css` Use logical CSS properties instead of left and right

**warning.** A physical left or right property stays on the same side in Arabic, so the margin, padding, border, offset or alignment is on the wrong edge and the layout looks unbalanced.

**Fix:** Use the logical property, such as margin-inline-start, padding-inline-end, inset-inline-start or text-align: start, so the side follows the reading direction.

<a id="source-arabic-letter-spacing"></a>
### `source/arabic-letter-spacing` No letter-spacing on Arabic text

**error.** Letter-spacing pulls the joined Arabic letters apart, so words break into separate glyphs and become hard to read.

**Fix:** Set letter-spacing: 0 (or remove it) for Arabic selectors, and keep tracking on Latin text only.

<a id="source-dir-attribute-selector"></a>
### `source/dir-attribute-selector` Prefer :dir() to a [dir] attribute selector

**note.** A [dir] attribute selector misses content whose direction is inherited from a parent or set by dir=auto, so that content keeps the wrong styles.

**Fix:** Use the :dir(rtl) or :dir(ltr) pseudo-class, which matches the direction that applies to the element.

## Known limits

- Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files are read. Vue, Svelte, Astro and MDX files are not.
- CSS written inside JavaScript, such as a styled-components or Emotion template literal, is not read as CSS.
- A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.
- A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.
- One inline `<script>` or `<style>` that does not parse, for example one holding template syntax, skips the whole HTML file.
- physical-css skips left and right set to a negative offset of 999 or more, such as left: -9999px in a visually-hidden block, and a pair of sides set to the same value, such as left: 0 with right: 0.
- physical-css skips left: 50% or right: 50% when the same block translates 50% on x, the centring idiom, because it looks the same in both directions.
- physical-css and arabic-letter-spacing read only the selectors in the file. A direction set by a parent selector in another file, or by a class, is not known.
- A file named directly on the command line is linted even when a .gitignore would skip it. Only directory walks honour .gitignore.
