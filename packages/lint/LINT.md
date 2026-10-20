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

<a id="source-physical-tailwind"></a>
### `source/physical-tailwind` Use logical Tailwind classes instead of left and right

**warning.** A physical class such as ml-4, pr-2, left-0, text-left or rounded-l-lg stays on the same side in Arabic, so the margin, padding, offset, alignment or corner is on the wrong edge.

**Fix:** Use the logical class, such as ms-4, pe-2, start-0 (inset-s-0 from Tailwind 4.2), text-start or rounded-s-lg, so the side follows the reading direction. Keep a physical class only under an rtl:, ltr: or side variant such as data-[side=left]:.

## Known limits

- Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files are read. Vue, Svelte, Astro and MDX files are not.
- CSS written inside JavaScript, such as a styled-components or Emotion template literal, is not read as CSS.
- A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.
- A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.
- One inline `<script>` or `<style>` that does not parse, for example one holding template syntax, skips the whole HTML file.
- physical-css skips left and right set to a negative offset of 999 or more, such as left: -9999px in a visually-hidden block, and a pair of sides set to the same value, such as left: 0 with right: 0.
- physical-css skips left: 50% or right: 50% when the same block translates 50% on x, the centring idiom, because it looks the same in both directions.
- physical-css and arabic-letter-spacing read only the selectors in the file. A direction set by a parent selector in another file, or by a class, is not known.
- physical-tailwind reads classes only from class and className attributes, @apply, and the calls clsx, cn, cx, twMerge, twJoin, classnames, classNames, cva and tv. Any other string, such as a safelist in tailwind.config.js, is not read.
- physical-tailwind reads a class helper only when it is called by its bare name, so utils.cn(...) or a renamed import is not read.
- physical-tailwind does not guess a class built at runtime, such as ml-${n} or a string joined with +, and reads only the keys of a clsx object and the class values of a cva or tv config.
- physical-tailwind finds the Tailwind version in the nearest package.json that lists tailwindcss, walking up past the lint folder to the repository top (a folder holding .git), and never into the home folder. The installed copy wins when it satisfies the declared range. Below 3.3, or with no version found, it stays quiet. A Tailwind prefix such as tw- is not known, so prefixed classes are not checked.
- physical-tailwind checks margin, padding, inset and scroll classes only with a Tailwind value: a number, a fraction, px, auto, full or an arbitrary value. A custom theme key such as ml-gutter, or a project class such as left-panel, is not checked.
- physical-tailwind skips a class under any variant holding rtl, ltr, left or right as a word, such as rtl:, group-[dir=rtl]: or data-[side=left]:, a matching pair that always applies together (in one string, or in unconditional parts of one attribute, class call or @apply), such as ml-2 mr-2 or left-0 right-0, left-1/2 or left-[50%] with a 50% x translate, the centring idiom, and an offscreen offset of 999 or more, such as -left-[9999px]. Arbitrary properties such as [margin-left:4px] are not checked.
- A file named directly on the command line is linted even when a .gitignore would skip it. Only directory walks honour .gitignore.
