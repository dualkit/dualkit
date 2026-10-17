import { defineRule, pick } from '../rule'
import { ENDS_WITH_ARABIC_MARK, ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, LATIN_TOKEN, excerpt, firstStrong } from '../text'

const LATIN_LETTER = /[A-Za-zÀ-ɏ]/

/** The direction a paragraph's words mostly run in, so a leading Latin word does not decide it. */
const naturalDirection = (s: string, share: number): 'ltr' | 'rtl' | null => {
  if (share > 0.5) return 'rtl'
  if (share < 0.5 && LATIN_LETTER.test(s)) return 'ltr'
  return firstStrong(s)
}

export const unisolatedNumber = defineRule({
  id: 'bidi/unisolated-number', group: 'bidi', severity: 'error',
  title: 'A number that will show in reverse',
  why: 'Inside right-to-left text the bidi algorithm reorders digit groups split by spaces, so 050 123 4567 shows as 4567 123 050.',
  fix: 'Wrap the number in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated && GROUPED_NUMBER.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is not isolated, so its groups can show in reverse order.` })),
})

export const unisolatedLatin = defineRule({
  id: 'bidi/unisolated-latin', group: 'bidi', severity: 'error',
  title: 'An email, link or code that will scramble',
  why: 'Punctuation inside emails, URLs and codes takes the direction of the Arabic around it, so dots and slashes jump to the wrong end.',
  fix: 'Wrap it in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated && LATIN_TOKEN.test(t.text))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" sits in right-to-left text without isolation.` })),
})

export const punctuationFlip = defineRule({
  id: 'bidi/punctuation-flip', group: 'bidi', severity: 'warning',
  title: 'Punctuation at the wrong end',
  why: 'When a paragraph runs in the opposite direction to its words, the closing mark shows at the start: "Hello world!" becomes "!Hello world".',
  fix: 'Give the block the direction of its own text, with dir="ltr", dir="rtl" or dir="auto".',
  check: (m) => m.texts
    .filter((t) => {
      if (!t.isLastInBlock || t.isolated) return false
      const neutral = ENDS_WITH_PUNCTUATION.test(t.blockText)
      const arabicMark = t.blockDir === 'rtl' && ENDS_WITH_ARABIC_MARK.test(t.blockText)
      if (!neutral && !arabicMark) return false
      const natural = naturalDirection(t.blockText, t.blockArabicShare)
      return natural !== null && natural !== t.blockDir
    })
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.blockText)}" runs ${t.blockDir === 'rtl' ? 'right to left' : 'left to right'}, so its last mark moves to the start.` })),
})

export const fieldDirection = defineRule({
  id: 'bidi/field-direction', group: 'bidi', severity: 'warning',
  title: 'A left-to-right field typed right to left',
  why: 'Emails, phone numbers, links and codes typed into a right-to-left field jump around as each character lands.',
  fix: 'Add dir="ltr" to the input, or dir="auto" if people may type Arabic too.',
  check: (m) => m.fields
    .filter((f) => f.kind !== 'text' && f.dir === 'rtl' && f.dirAttr === null)
    .map((f) => ({ node: pick(f), message: `This ${f.kind} field inherits right to left.` })),
})

export const bidiRules = [unisolatedNumber, unisolatedLatin, punctuationFlip, fieldDirection]
