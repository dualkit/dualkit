/**
 * Which @dualkit/rules check_html runs in jsdom. A rule is checked only when everything it reads comes from the
 * markup, the dir and lang attributes, CSS display and direction, or the text itself. The rest read layout, fonts,
 * transforms or typing, which need a real browser, so they are reported as not checked.
 */
export const JSDOM_CHECKED: readonly string[] = [
  'bidi/unisolated-number', 'bidi/unisolated-latin', 'bidi/date-order', 'bidi/punctuation-flip', 'bidi/field-direction',
  'layout/arabic-ltr-block',
  'content/missing-lang', 'content/missing-dir', 'content/lang-mismatch', 'content/mixed-digits', 'content/placeholder-text',
  'content/old-rial-sign', 'content/dirham-sign-with-code', 'content/label-language', 'content/latin-punctuation', 'content/currency-order',
]

const IN_A_BROWSER = 'Run npx dualkit check on the page to include it.'
const LAYOUT = `It measures rendered boxes, and jsdom does no layout. ${IN_A_BROWSER}`
const FONTS = `It reads which web fonts loaded and what they draw, and jsdom loads no fonts. ${IN_A_BROWSER}`
const TRANSFORMS = `It reads CSS transforms and drawn shapes, which jsdom does not compute. ${IN_A_BROWSER}`
const COMPUTED = `It reads computed font size, spacing or style, which jsdom does not inherit or resolve. ${IN_A_BROWSER}`

export const JSDOM_NOT_CHECKED: Readonly<Record<string, string>> = {
  'bidi/field-placeholder': `It reads ::placeholder styles, which jsdom does not compute. ${IN_A_BROWSER}`,
  'layout/physical-spacing': COMPUTED,
  'layout/physical-inset': LAYOUT,
  'layout/text-align-left': LAYOUT,
  'layout/mirrored-text': TRANSFORMS,
  'layout/clipped-text': LAYOUT,
  'icons/not-mirrored': TRANSFORMS,
  'icons/arrow-points-forward': TRANSFORMS,
  'icons/mirrored-by-mistake': TRANSFORMS,
  'type/arabic-leading': LAYOUT,
  'type/arabic-tracking': COMPUTED,
  'type/arabic-italic': COMPUTED,
  'type/arabic-font': FONTS,
  'type/arabic-size': COMPUTED,
  'type/arabic-faux-bold': FONTS,
  'type/arabic-broken-join': LAYOUT,
  'content/currency-sign-font': FONTS,
  'content/drops-arabic-digits': `It types into fields in a real browser. ${IN_A_BROWSER}`,
}

/** A rule added to @dualkit/rules after this list was written. */
export const UNCLASSIFIED = `This version of @dualkit/mcp does not know whether jsdom can check it. ${IN_A_BROWSER}`
