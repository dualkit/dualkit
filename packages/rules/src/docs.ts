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
  'A label-language note still fires on brand names of more than one word, such as "Apple Pay" or "American Express" in an image alt on an Arabic page.',
  'An icon is named from its data attribute, sprite reference, class, glyph text, aria-label, title, SVG <title>, or the aria-label of the button or link around it when the icon is the only content of that control. A fully unnamed SVG that is not alone in a labelled control is not recognised, so its direction is not checked. An unnamed icon that is the only content of a control takes the name of that control, so a non-directional glyph in a control named with a direction word is read as directional.',
  'Text is checked for a flip on its own element and up to 4 ancestors. A flip is a transform whose determinant is negative, such as scaleX(-1), scale: -1 1 or rotateY(180deg). rotate(180deg) and scale(-1,-1) turn text upside down without mirroring it, so they are not counted. Only text with Arabic letters is reported, so a flipped arrow glyph or icon-font ligature is left to the icon rules. A flip applied further up, or by a filter or animation, is not seen.',
  'A direction icon counts as pointing the other way when it is flipped or turned, so rotate(180deg) (Tailwind rtl:rotate-180) passes icons/not-mirrored. A play icon that is only turned is not reported as mirrored by mistake.',
  'A clipped box is found when it scrolls and its own text, measured by the painted text boxes, reaches past its padding box. A box that scrolls only for an oversized image is not flagged. Only boxes whose cut-off text contains Arabic are flagged. Ink that sticks out of a text box that still fits its line, such as a dot just under a tight line, is not measured.',
  'Only text at least partly inside a clipped box counts. Text painted wholly outside it, such as the other slides of a carousel, is ignored. -webkit-line-clamp (Tailwind line-clamp-2) draws its own ellipsis, so it counts as one.',
  'A "read more" box cut off with max-height and overflow: hidden is reported, though the cut may be on purpose.',
  'Masks that reveal part of a strip by transform (odometers, rolling labels) look like clipped text.',
  'A word counts as split only when both halves sit in one line of inline content, with no list item, table cell, block, or flex or grid item between them, and the two letters at the boundary touch on the same line, less than 1px apart. Separate boxes with no space between them in the markup, such as nav links, tabs, table cells or a badge with a margin, are not one word.',
  'A webfont with the default unicode-range counts as Arabic when its name says so, or when it draws alef (U+0627) at a width different from its own missing-glyph box and from the sans-serif or serif fallback, by more than 0.5px at 48px. A font whose alef matched every fallback that closely would be missed.',
  'The Arabic placeholder check reads where the hint lands from text-align on the field and on ::placeholder, with start and end resolved against the field\'s direction. It runs only on right-to-left pages.',
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
