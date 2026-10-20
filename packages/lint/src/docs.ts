import type { LintRule } from './types'

/** Raw tags in prose (<style>, <bdi>) are stripped as HTML on GitHub, so they are wrapped as code spans. */
const HTML_TAG = /<[^>\s][^>]*>/g
const asCode = (text: string): string => text.replace(HTML_TAG, '`$&`')

/** What the source rules leave alone on purpose. */
export const LINT_KNOWN_LIMITS: readonly string[] = [
  'Only .css, .scss, .html, .htm, .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files are read. Vue, Svelte, Astro and MDX files are not.',
  'A physical side is checked on its own. When it pairs with a side set elsewhere, such as an inline left value written by script, switching only the stylesheet side breaks right-to-left. Change both sides together, or suppress the line with a reason.',
  'CSS written inside JavaScript, such as a styled-components or Emotion template literal, is not read as CSS.',
  'A file over 1 MB, or with an average line longer than 500 characters, is treated as minified and skipped.',
  'A file that does not parse is listed as skipped with the parser message, and none of its lines are checked.',
  'One inline <script> or <style> that does not parse, for example one holding template syntax, skips the whole HTML file.',
  'physical-css skips left and right set to a negative offset of 999 or more, such as left: -9999px in a visually-hidden block, and a pair of sides set to the same value, such as left: 0 with right: 0.',
  'physical-css skips left: 50% or right: 50% when the same block translates 50% on x, the centring idiom, because it looks the same in both directions.',
  'physical-css skips a declaration when the same file has a :dir(), [dir] or :lang(ar) rule for the same selector, with the direction part removed, that sets a property of the same family, as in .n { left: 0 } .n:dir(rtl) { left: auto; right: 0 }. An override in another file is not seen.',
  'arabic-letter-spacing skips a selector whose subject (its last part) is code, pre, kbd or samp, since that is usually Latin code inside an Arabic page.',
  'physical-css and arabic-letter-spacing read only the selectors in the file. A direction set by a parent selector in another file, or by a class, is not known.',
  'physical-tailwind reads classes only from class and className attributes, @apply, and the calls clsx, cn, cx, twMerge, twJoin, classnames, classNames, cva and tv. Any other string, such as a safelist in tailwind.config.js, is not read.',
  'physical-tailwind reads a class helper only when it is called by its bare name, so utils.cn(...) or a renamed import is not read.',
  'physical-tailwind does not guess a class built at runtime, such as ml-${n} or a string joined with +, and reads only the keys of a clsx object and the class values of a cva or tv config.',
  'physical-tailwind finds the Tailwind version in the nearest package.json that lists tailwindcss, walking up past the lint folder to the repository top (a folder holding .git), and never into the home folder. The installed copy wins when it satisfies the declared range. Below 3.3, or with no version found, it stays quiet. A Tailwind prefix such as tw- is not known, so prefixed classes are not checked.',
  'physical-tailwind checks margin, padding, inset and scroll classes only with a Tailwind value: a number, a fraction, px, auto, full or an arbitrary value. A custom theme key such as ml-gutter, or a project class such as left-panel, is not checked.',
  'physical-tailwind skips a class under any variant holding rtl, ltr, left or right as a word, such as rtl:, group-[dir=rtl]: or data-[side=left]:, a matching pair that always applies together (in one string, or in unconditional parts of one attribute, class call or @apply), such as ml-2 mr-2 or left-0 right-0, left-1/2 or left-[50%] with a 50% x translate, the centring idiom, and an offscreen offset of 999 or more, such as -left-[9999px]. Arbitrary properties such as [margin-left:4px] are not checked.',
  'physical-tailwind skips a physical class when the same attribute, class call or @apply also holds an rtl: or ltr: class of the same family (margin, padding, inset, rounded, border, text-align, float and clear, scroll-margin, scroll-padding), as in ml-4 rtl:ml-0 rtl:mr-4. It does not check that the override undoes the base side. It also skips both arms of a ternary whose test compares with the string left or right, such as side === \'left\' ? \'left-0\' : \'right-0\', and cva or tv variant values under a left or right key.',
  'intl-digits, islamic-calendar and hijri-time-zone read only new Intl.NumberFormat and new Intl.DateTimeFormat (with or without new), and the methods toLocaleString, toLocaleDateString and toLocaleTimeString on any receiver. A destructured or aliased constructor, such as const { NumberFormat } = Intl, is not read.',
  'intl-digits fires only when the first locale is a string literal (or a template without expressions) that is ar or starts with ar-, in any case, or an array of string literals whose first item is one, because Intl uses the first locale it supports. A locale held in a variable, a spread, or an array with a non-literal item is quiet.',
  'The Intl rules go quiet when the options argument is anything but an object literal with plain keys: a variable, a spread, a computed key or a method. A numberingSystem, calendar or timeZone given any value, even a variable, counts as set.',
  'islamic-calendar and hijri-time-zone read the calendar option, or the -u-ca- extension of the first locale when the option is absent. A calendar held in a variable is not known. hijri-time-zone treats islamic, islamic-umalqura, islamic-civil, islamic-tbla and islamic-rgsa alike.',
  'old-rial-sign reads U+FDFC in string literals, template text, JSX text and attributes, HTML text and attributes, inline scripts, and CSS outside comments, including a CSS escape such as \\FDFC. A sign built at runtime, such as String.fromCharCode(0xFDFC), a regular expression literal, or a sign in a file type that is not read, is not found.',
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
