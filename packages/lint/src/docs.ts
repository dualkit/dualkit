import type { LintRule } from './types'

/** Raw tags in prose (<style>, <bdi>) are stripped as HTML on GitHub, so they are wrapped as code spans. */
const HTML_TAG = /<[^>\s][^>]*>/g
const asCode = (text: string): string => text.replace(HTML_TAG, '`$&`')

/** What the source rules leave alone on purpose. */
export const LINT_KNOWN_LIMITS: readonly string[] = [
  'Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files are read. Vue, Svelte, Astro and MDX files are not.',
  'CSS written inside JavaScript, such as a styled-components or Emotion template literal, is not read as CSS.',
  'A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.',
  'A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.',
  'One inline <script> or <style> that does not parse, for example one holding template syntax, skips the whole HTML file.',
  'physical-css skips left and right set to a negative offset of 999 or more, such as left: -9999px in a visually-hidden block, and a pair of sides set to the same value, such as left: 0 with right: 0.',
  'physical-css skips left: 50% or right: 50% when the same block translates 50% on x, the centring idiom, because it looks the same in both directions.',
  'physical-css and arabic-letter-spacing read only the selectors in the file. A direction set by a parent selector in another file, or by a class, is not known.',
  'physical-tailwind reads classes only from class and className attributes, @apply, and the calls clsx, cn, cx, twMerge, twJoin, classnames, classNames, cva and tv. Any other string, such as a safelist in tailwind.config.js, is not read.',
  'physical-tailwind does not guess a class built at runtime, such as ml-${n} or a string joined with +, and reads only the keys of a clsx object and the class values of a cva or tv config.',
  'physical-tailwind finds the Tailwind version in the nearest package.json that lists tailwindcss, preferring the installed copy. Below 3.3, or with no version found, it stays quiet. A Tailwind prefix such as tw- is not known, so prefixed classes are not checked.',
  'physical-tailwind skips a class under any variant holding rtl or ltr as a word, such as rtl:, group-[dir=rtl]: or [dir=rtl]_&:, a matching pair in the same string, such as ml-2 mr-2 or left-0 right-0, and left-1/2 with translate-x-1/2, the centring idiom. Arbitrary properties such as [margin-left:4px] are not checked.',
  'A file named directly on the command line is linted even when a .gitignore would skip it. Only directory walks honour .gitignore.',
]

/** LINT.md, generated from the rules so the docs never drift. Run UPDATE_LINT_MD=1 npx vitest run to refresh. */
export function renderLintMarkdown(rules: readonly LintRule[]): string {
  const lines = ['# Dualkit lint rules', '', 'Generated from `src/rules`. Each rule reads source files, before anything renders.', '']
  if (rules.length > 0) {
    lines.push('## Source', '')
    for (const r of rules) {
      lines.push(`<a id="${r.id.replace(/[^a-z0-9]+/g, '-')}"></a>`, `### \`${r.id}\` ${r.title}`, '', `**${r.severity}.** ${asCode(r.why)}`, '', `**Fix:** ${asCode(r.fix)}`, '')
    }
  }
  lines.push('## Known limits', '', ...LINT_KNOWN_LIMITS.map((l) => `- ${asCode(l)}`), '')
  return `${lines.join('\n').trimEnd()}\n`
}
