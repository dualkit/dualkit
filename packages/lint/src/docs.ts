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
