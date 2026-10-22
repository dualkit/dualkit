import type { Group } from '@dualkit/rules'
import type { Feature } from './features'

export type ReviewRule = { id: string; group: Group; features: Feature[]; title: string; ask: string; fix: string }

/** An empty features list means the rule applies to every screen. */
export const REVIEW_RULES: ReviewRule[] = [
  {
    id: 'review/date-reads-wrong', group: 'content', features: ['dates'],
    title: 'A date that an Arabic reader would read in the wrong order',
    ask: 'Find dates where the day, month and year come in an order or direction an Arabic reader would not expect, such as a year shown first or a date that looks reversed.',
    fix: 'Format the date with the Arabic locale and keep it in one direction, for example with Intl.DateTimeFormat("ar").',
  },
  {
    id: 'review/amount-reads-wrong', group: 'content', features: ['money'],
    title: 'An amount or currency that is read wrongly',
    ask: 'Find prices or amounts where the number and the currency sit on the wrong sides of each other, or where the sign, symbol or digits make the amount hard or misleading to read for an Arabic reader.',
    fix: 'Format money with Intl.NumberFormat("ar", { style: "currency" }) so the sign and number follow the Arabic order.',
  },
  {
    id: 'review/icon-direction-wrong', group: 'icons', features: ['icons'],
    title: 'An icon that points the wrong way or flips when it should not',
    ask: 'Find icons that point the wrong way for an Arabic reader, such as a back arrow pointing right-to-left in the wrong direction, or icons that were flipped but have a fixed meaning, such as a clock, a play button, a checkmark or a logo.',
    fix: 'Mirror only icons that show direction, such as arrows and chevrons, and leave the rest as they are.',
  },
  {
    id: 'review/arabic-reads-machine-translated', group: 'content', features: [],
    title: 'Arabic that reads like a machine translation',
    ask: 'Find Arabic text that sounds like a word-for-word translation from English, uses unnatural phrasing, or mixes formal and spoken Arabic in the same place.',
    fix: 'Have a native speaker rewrite the text in one consistent register, and avoid translating button and label text word for word.',
  },
  {
    id: 'review/arabic-truncated-or-overlapping', group: 'layout', features: [],
    title: 'Arabic text that is cut off or overlaps something',
    ask: 'Find Arabic text that is cut off, runs under another element, or overlaps a neighbouring label, icon or button, so part of it cannot be read.',
    fix: 'Let the container grow with the text, or wrap the text, instead of fixing its width or height.',
  },
  {
    id: 'review/table-column-order-wrong', group: 'layout', features: ['tables'],
    title: 'Table columns in the wrong order for right-to-left',
    ask: 'Find tables where the first column sits on the left and the columns run left to right, when an Arabic reader expects the first column on the right.',
    fix: 'Set dir="rtl" on the table or page so the first column starts on the right.',
  },
  {
    id: 'review/chat-bubble-side-wrong', group: 'layout', features: ['chat'],
    title: 'Chat bubbles on the wrong side',
    ask: 'Find chat or message bubbles where the sides look swapped for right-to-left, such as the person\'s own messages on the left, or bubble tails pointing the wrong way.',
    fix: 'Place bubbles with logical properties such as margin-inline-start and align-self: flex-start so they follow the reading direction.',
  },
  {
    id: 'review/form-labels-misplaced', group: 'layout', features: ['forms'],
    title: 'Form labels or errors on the wrong side',
    ask: 'Find form labels, hints, error messages or required marks that sit on the wrong side of their field for an Arabic reader, or that are aligned to the left when the form reads from the right.',
    fix: 'Align labels and errors to the start edge with text-align: start, and use logical properties for the spacing.',
  },
]

export function pickRules(features: Feature[]): ReviewRule[] {
  return REVIEW_RULES.filter((r) => r.features.length === 0 || r.features.some((f) => features.includes(f)))
}
