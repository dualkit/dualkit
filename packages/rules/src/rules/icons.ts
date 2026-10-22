import type { IconNode } from '../model'
import { defineRule, pick } from '../rule'

export const DIRECTIONAL_ICON =
  /(arrow|chevron|caret|angle|triangle)[-_ ]?(left|right|back|forward|start|end)|(^|[-_ ])(back|forward|next|prev|previous|reply|send|undo|redo)([-_ ]|$)/i
/** Media transport (fast-forward, skip-next) follows the timeline, not the reading order, so it never mirrors. */
export const MEDIA_TRANSPORT_ICON = /^(fast|skip|media)[-_ ]|play[-_ ]?next|seek/i
/** Help and question icons are left out: the Arabic question mark is itself mirrored. */
export const NEVER_MIRROR_ICON = /(^|[-_ ])(play|pause|check|checkmark|tick|clock|logo|brand)([-_ ]|$)/i

const directional = (name: string): boolean => DIRECTIONAL_ICON.test(name) && !MEDIA_TRANSPORT_ICON.test(name)

/** In right to left, back points right and forward points left. A head the other way sends the reader the wrong way. */
const pointsForward = (i: IconNode): boolean =>
  i.dir === 'rtl' && i.head !== null && ((i.role === 'back' && i.head === 'left') || (i.role === 'forward' && i.head === 'right'))

export const arrowPointsForward = defineRule({
  id: 'icons/arrow-points-forward', group: 'icons', severity: 'warning',
  title: 'A back or next arrow drawn pointing the wrong way',
  why: 'Arabic reads right to left, so a back arrow points right and a next arrow points left. An arrow drawn the other way sends the reader the wrong way.',
  fix: 'In right to left, draw the arrow the other way, mirror it with a :dir(rtl) { transform: scaleX(-1) } rule, or swap the glyph, such as ← for →.',
  check: (m) => m.icons
    .filter(pointsForward)
    .map((i) => ({ node: pick(i), message: `This ${i.role === 'back' ? 'back' : 'next'} arrow points ${i.head} in right-to-left. It should point ${i.head === 'left' ? 'right' : 'left'}.` })),
})

export const notMirrored = defineRule({
  id: 'icons/not-mirrored', group: 'icons', severity: 'warning',
  title: 'A direction icon that points the wrong way',
  why: 'Back, forward and chevron icons describe reading order, so in Arabic they must point the other way.',
  fix: 'Mirror it in RTL with a :dir(rtl) { transform: scaleX(-1) } rule, or swap to the opposite icon.',
  // A turn such as Tailwind's rtl:rotate-180 points a symmetric arrow the other way too, so it counts.
  check: (m) => m.icons
    // An icon that arrow-points-forward reports is left to it: that finding is more exact.
    .filter((i) => i.dir === 'rtl' && !i.mirrored && !i.turned && i.name !== null && directional(i.name) && !pointsForward(i))
    .map((i) => ({ node: pick(i), message: `"${i.name}" is not mirrored in right-to-left. Check it points the way the reader moves.` })),
})

export const mirroredByMistake = defineRule({
  id: 'icons/mirrored-by-mistake', group: 'icons', severity: 'error',
  title: 'An icon that must never mirror',
  why: 'Play, check marks, clocks and logos mean the same thing in every language, and flipped they look wrong.',
  fix: 'Remove the flip from this icon.',
  check: (m) => m.icons
    .filter((i) => i.mirrored && i.name !== null && NEVER_MIRROR_ICON.test(i.name))
    .map((i) => ({ node: pick(i), message: `"${i.name}" is mirrored.` })),
})

export const iconRules = [notMirrored, arrowPointsForward, mirroredByMistake]
