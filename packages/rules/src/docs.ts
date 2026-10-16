import type { Rule } from './rule'

const GROUP_TITLE = { bidi: 'Bidi', layout: 'Layout', icons: 'Icons', type: 'Type', content: 'Content' } as const

/** RULES.md, generated from the rules so the docs never drift. Run UPDATE_RULES_MD=1 npm test to refresh. */
export function renderRulesMarkdown(rules: readonly Rule[]): string {
  const lines = ['# Dualkit rules', '', 'Generated from `src/rules`. Each rule runs on the rendered page.', '']
  for (const group of Object.keys(GROUP_TITLE) as (keyof typeof GROUP_TITLE)[]) {
    lines.push(`## ${GROUP_TITLE[group]}`, '')
    for (const r of rules.filter((x) => x.group === group)) {
      lines.push(`<a id="${r.id.replace(/[^a-z0-9]+/g, '-')}"></a>`, `### \`${r.id}\` ${r.title}`, '', `**${r.severity}.** ${r.why}`, '', `**Fix:** ${r.fix}`, '')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}
