import { RULES, type Rule } from '@dualkit/rules'

// Which rules the plugin runs. A rule runs in Figma only when everything it reads exists in a Figma layer. Every other rule is
// listed with the reason, so the panel says what was not checked instead of leaving it out. A test fails when a rule is added to
// @dualkit/rules and not placed here.

const CHECKED_IDS = [
  'type/arabic-leading', 'type/arabic-tracking', 'type/arabic-italic', 'type/arabic-font', 'type/arabic-size',
  'bidi/unisolated-number', 'bidi/unisolated-latin', 'bidi/date-order', 'bidi/punctuation-flip',
  'content/mixed-digits', 'content/placeholder-text', 'content/old-rial-sign', 'content/dirham-sign-with-code',
  'content/latin-punctuation', 'content/currency-order',
  'layout/text-align-left',
] as const

const HTML_LANG = 'It reads the lang and dir attributes of the built page, which a Figma frame does not have.'
const CSS = 'It reads the CSS the code uses, which a Figma frame does not have.'
const FIELD = 'It reads real form fields, which a Figma frame does not have.'
const ICON = 'It reads the drawn direction and role of each icon, which this version does not read from vectors.'

const REASONS: Record<string, string> = {
  'type/arabic-faux-bold': 'Figma draws every style from a real font file, so a faked bold only shows in the built page.',
  'type/arabic-broken-join': 'It needs the browser to shape the text across inline boxes.',
  'bidi/field-direction': FIELD,
  'bidi/field-placeholder': FIELD,
  'content/missing-lang': HTML_LANG,
  'content/missing-dir': HTML_LANG,
  'content/lang-mismatch': HTML_LANG,
  'content/label-language': 'It reads aria-label, alt and title attributes, which a Figma frame does not have.',
  'content/currency-sign-font': 'It measures whether the font draws the new currency sign, which the plugin cannot ask Figma.',
  'content/drops-arabic-digits': 'It types Arabic digits into a live field.',
  'layout/physical-spacing': CSS,
  'layout/physical-inset': CSS,
  'layout/arabic-ltr-block': HTML_LANG,
  'layout/mirrored-text': 'It reads CSS transforms on the built page.',
  'layout/clipped-text': 'It measures text cut off by overflow in the built page.',
  'icons/arrow-points-forward': ICON,
  'icons/not-mirrored': ICON,
  'icons/mirrored-by-mistake': ICON,
}

export type SkippedRule = { id: string; title: string; reason: string }

const checkedSet = new Set<string>(CHECKED_IDS)

export const CHECKED_IN_FIGMA: readonly Rule[] = RULES.filter((r) => checkedSet.has(r.id))

export const NOT_CHECKED_IN_FIGMA: readonly SkippedRule[] = RULES
  .filter((r) => !checkedSet.has(r.id))
  .map((r) => ({ id: r.id, title: r.title, reason: REASONS[r.id] ?? 'It needs data a Figma frame does not have.' }))
