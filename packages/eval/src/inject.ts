import { applyEdits, bodyOf } from './inject-html.js'
import { arabicTracking, currencySide, cutLabel, dateOrder, latinPunctuation, numberIsolation, type Finder } from './inject-text.js'
import { backArrow, otpDigits } from './inject-ui.js'

export type BugKind =
  | 'date-order'
  | 'back-arrow'
  | 'otp-digits'
  | 'currency-side'
  | 'cut-label'
  | 'latin-punctuation'
  | 'arabic-tracking'
  | 'number-isolation'

/** Plants one known Arabic bug in a page. Null when nothing on the page fits. */
export type Injector = {
  readonly kind: BugKind
  inject(html: string): string | null
}

function injector(kind: BugKind, find: Finder): Injector {
  return {
    kind,
    inject(html) {
      const edits = find(html, bodyOf(html))
      return edits === null ? null : applyEdits(html, edits)
    },
  }
}

export const INJECTORS: readonly Injector[] = [
  injector('date-order', dateOrder),
  injector('back-arrow', backArrow),
  injector('otp-digits', otpDigits),
  injector('currency-side', currencySide),
  injector('cut-label', cutLabel),
  injector('latin-punctuation', latinPunctuation),
  injector('arabic-tracking', arabicTracking),
  injector('number-isolation', numberIsolation),
]
