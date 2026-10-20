import type { Rule } from './rule'

/** Raw tags in prose (<html>, <bdi>) are stripped as HTML on GitHub, so they are wrapped as code spans. */
export const HTML_TAG = /<[^>\s][^>]*>/g
export const asCode = (text: string): string => text.replace(HTML_TAG, '`$&`')

const GROUP_TITLE = { bidi: 'Bidi', layout: 'Layout', icons: 'Icons', type: 'Type', content: 'Content' } as const

/** What the rules leave alone on purpose, each measured in Chromium (see test/verify.test.ts). */
export const KNOWN_LIMITS: readonly string[] = [
  'A closing mark in the middle of a line, such as the ! in "Hello world! مرحبا", is not checked. Only the end of a paragraph, or of a line that a <br> closes on its own, is.',
  'Emails, links and codes are flagged only where Chromium paints them differently once isolated: with a leading #, a trailing slash, or a Western digit beside them. In the middle of a sentence, at either end of a block, or before a full stop or bracket they paint the same, so they are not flagged.',
  'An email, link or code beside a Latin word is not flagged: isolating it only splits one left-to-right phrase that already reads in order.',
  'Groups of Arabic-Indic digits paint the same with or without <bdi>, so they are not flagged.',
  'A new currency sign counts as drawn when a loaded font declares it in an explicit unicode-range, or when the page\'s own webfont draws it at a different width from both its missing-glyph box and plain sans-serif. A font that has the sign at exactly the width of the system fallback glyph would be missed.',
  'Only the pairing of the dirham sign with AED is flagged, because that is the one the Central Bank of the UAE guideline forbids. Dh and the Arabic word are not in the guideline, so they are left alone.',
  'A label is flagged only when it is wholly in the other script, such as a Latin sentence on an Arabic page. Labels that mix scripts, and one-word names like Visa, are left alone.',
  'An icon is named from its data attribute, sprite reference, class, glyph text, aria-label, title, SVG <title>, or the aria-label of the button or link around it. A fully unnamed SVG is not recognised, so its direction is not checked.',
  'Text is checked for a horizontal flip on its own element and up to 4 ancestors. A flip applied further up, or by a filter or animation, is not seen.',
  'A clipped box is found from its scroll size against its client size, which counts line boxes. Ink that sticks out of a box that still fits its line, such as a dot just under a tight line, is not measured.',
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
