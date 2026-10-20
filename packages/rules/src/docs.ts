import type { Rule } from './rule'

/** Raw tags in prose (<html>, <bdi>) are stripped as HTML on GitHub, so they are wrapped as code spans. */
const HTML_TAG = /<[^>\s][^>]*>/g
const asCode = (text: string): string => text.replace(HTML_TAG, '`$&`')

const GROUP_TITLE = { bidi: 'Bidi', layout: 'Layout', icons: 'Icons', type: 'Type', content: 'Content' } as const

/** What the rules leave alone on purpose, each measured in Chromium (see test/verify.test.ts). */
export const KNOWN_LIMITS: readonly string[] = [
  'A closing mark in the middle of a line, such as the ! in "Hello world! مرحبا", is not checked. Only the end of a paragraph, or of a line that a <br> closes on its own, is.',
  'Codes without a leading # (A10293, A-10293) and groups of Arabic-Indic digits paint the same with or without <bdi>, so they are not flagged.',
  'A number with a leading # (#10293) also shows in reverse inside Arabic, but it is not an email, link or code, so no rule covers it yet.',
]

/** RULES.md, generated from the rules so the docs never drift. Run UPDATE_RULES_MD=1 npm test to refresh. */
export function renderRulesMarkdown(rules: readonly Rule[]): string {
  const lines = ['# Dualkit rules', '', 'Generated from `src/rules`. Each rule runs on the rendered page.', '']
  for (const group of Object.keys(GROUP_TITLE) as (keyof typeof GROUP_TITLE)[]) {
    lines.push(`## ${GROUP_TITLE[group]}`, '')
    for (const r of rules.filter((x) => x.group === group)) {
      lines.push(`<a id="${r.id.replace(/[^a-z0-9]+/g, '-')}"></a>`, `### \`${r.id}\` ${r.title}`, '', `**${r.severity}.** ${asCode(r.why)}`, '', `**Fix:** ${asCode(r.fix)}`, '')
    }
  }
  lines.push('## Known limits', '', ...KNOWN_LIMITS.map((l) => `- ${asCode(l)}`), '')
  return `${lines.join('\n').trimEnd()}\n`
}
