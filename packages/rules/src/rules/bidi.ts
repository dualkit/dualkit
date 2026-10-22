import type { TextRun } from '../model'
import { defineRule, pick } from '../rule'
import { ENDS_WITH_ARABIC_MARK, ENDS_WITH_PUNCTUATION, GROUPED_NUMBER, arabicShare, excerpt, hasArabic, firstStrong, forcedLtrDateScrambles, hashNumberScrambles, lastStrong, reorderedDashDates, scrambledLatinTokens } from '../text'

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
  why: 'Inside right-to-left text the bidi algorithm reorders digit groups split by spaces and moves a leading # or +, so 050 123 4567 shows as 4567 123 050.',
  fix: 'Wrap the number in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated && (GROUPED_NUMBER.test(t.text) || hashNumberScrambles(t.text, t.blockText)))
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is not isolated, so its groups can show in reverse order.` })),
})

export const unisolatedLatin = defineRule({
  id: 'bidi/unisolated-latin', group: 'bidi', severity: 'error',
  title: 'An email, link or code that will scramble',
  why: 'A leading #, a trailing slash or a digit beside an email, link or code takes the direction of the Arabic around it, so it jumps to the wrong end.',
  fix: 'Wrap it in <bdi>, or give its element dir="ltr".',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl' && !t.isolated)
    .flatMap((t) => scrambledLatinTokens(t.text, t.blockText).slice(0, 1).map((token) => ({ node: pick(t), message: `"${excerpt(token)}" sits in right-to-left text without isolation, so part of it can move.` }))),
})

/** The first date in this run that Chromium paints in the wrong order, with why, or null. */
function misorderedDate(t: TextRun): { date: string; why: string } | null {
  const dashed = reorderedDashDates(t.text, t.blockText, t.isolated)[0]
  if (dashed !== undefined) return { date: dashed, why: 'its dashes do not hold Arabic numbers together, so the parts show in reverse order' }
  if (t.forcedLtr && forcedLtrDateScrambles(t.text)) return { date: t.text, why: 'it is forced left to right, so its Arabic and its numbers show in reverse order' }
  return null
}

export const dateOrder = defineRule({
  id: 'bidi/date-order', group: 'bidi', severity: 'error',
  title: 'A date that will show in the wrong order',
  why: 'Inside right-to-left text, digits joined by - become Arabic numbers when they are Arabic-Indic or follow an Arabic word, and a - does not hold those together, so 15-03-2025 shows as 2025-03-15. A worded Arabic date such as 15 مارس 2025، 10:00 ص, forced left to right with dir="ltr", shows its words and numbers backwards.',
  fix: 'Join the parts with / instead of -, or wrap a Western-digit date in <bdi dir="ltr">. Leave a worded Arabic date right to left.',
  check: (m) => m.texts
    .filter((t) => t.blockDir === 'rtl')
    .flatMap((t) => {
      const found = misorderedDate(t)
      return found === null ? [] : [{ node: pick(t), message: `"${excerpt(found.date)}": ${found.why}.` }]
    }),
})

/**
 * Whether the closing mark of this text lands at the far end of its line, against the way it reads.
 * The text is the whole block for the block's last run, or just the run for one that ends a line before a <br>.
 */
function flips(text: string, share: number, blockDir: 'ltr' | 'rtl'): boolean {
  const neutral = ENDS_WITH_PUNCTUATION.test(text)
  const arabicMark = ENDS_WITH_ARABIC_MARK.test(text) && (blockDir === 'rtl' || lastStrong(text.replace(ENDS_WITH_ARABIC_MARK, '')) !== 'rtl')
  if (!neutral && !arabicMark) return false
  const natural = naturalDirection(text, share)
  return natural !== null && natural !== blockDir
}

export const punctuationFlip = defineRule({
  id: 'bidi/punctuation-flip', group: 'bidi', severity: 'warning',
  title: 'Punctuation at the wrong end',
  why: 'When a paragraph runs in the opposite direction to its words, the closing mark shows at the start: "Hello world!" becomes "!Hello world".',
  fix: 'Give the block the direction of its own text, with dir="ltr", dir="rtl" or dir="auto".',
  check: (m) => m.texts
    .filter((t) => !t.isolated && (t.isLastInBlock || t.endsLine))
    .map((t) => ({ t, closing: t.isLastInBlock ? { text: t.blockText, share: t.blockArabicShare } : { text: t.text, share: arabicShare(t.text) } }))
    .filter(({ t, closing }) => flips(closing.text, closing.share, t.blockDir))
    .map(({ t, closing }) => ({ node: pick(t), message: `"${excerpt(closing.text)}" runs ${t.blockDir === 'rtl' ? 'right to left' : 'left to right'}, so its last mark moves to the start.` })),
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

export const fieldPlaceholder = defineRule({
  id: 'bidi/field-placeholder', group: 'bidi', severity: 'warning',
  title: 'An Arabic hint on the wrong side of the field',
  why: 'A field that runs left to right paints its placeholder at the left edge, so on a right-to-left page an Arabic hint sits where Arabic readers look last.',
  fix: 'Keep dir="ltr" for what people type, and right-align the Arabic hint with input:placeholder-shown { direction: rtl } or ::placeholder { text-align: right }.',
  // Only a hint that lands at the left: text-align: right on the field or on ::placeholder already puts it flush right.
  check: (m) => m.root.computedDir !== 'rtl' ? [] : m.fields
    .filter((f) => f.dir === 'ltr' && f.placeholderSide === 'left' && f.placeholderShown && hasArabic(f.placeholder))
    .map((f) => ({ node: pick(f), message: `The placeholder "${excerpt(f.placeholder)}" is Arabic in a left-to-right field.` })),
})

export const bidiRules = [unisolatedNumber, unisolatedLatin, dateOrder, punctuationFlip, fieldDirection, fieldPlaceholder]
