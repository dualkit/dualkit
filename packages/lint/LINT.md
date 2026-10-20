# Dualkit lint rules

Generated from `src/rules`. Each rule reads source files, before anything renders.

## Known limits

- Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files are read. Vue, Svelte, Astro and MDX files are not.
- CSS written inside JavaScript, such as a styled-components or Emotion template literal, is not read as CSS.
- A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.
- A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.
- One inline `<script>` or `<style>` that does not parse, for example one holding template syntax, skips the whole HTML file.
- A file named directly on the command line is linted even when a .gitignore would skip it. Only directory walks honour .gitignore.
