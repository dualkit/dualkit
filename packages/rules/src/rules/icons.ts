import { defineRule, pick } from '../rule'

export const DIRECTIONAL_ICON =
  /(arrow|chevron|caret|angle|triangle)[-_ ]?(left|right|back|forward|start|end)|(^|[-_ ])(back|forward|next|prev|previous|reply|send|undo|redo)([-_ ]|$)/i
export const NEVER_MIRROR_ICON = /(^|[-_ ])(play|pause|check|checkmark|tick|clock|logo|brand|help|question)([-_ ]|$)/i

export const notMirrored = defineRule({
  id: 'icons/not-mirrored', group: 'icons', severity: 'warning',
  title: 'A direction icon that points the wrong way',
  why: 'Back, forward and chevron icons describe reading order, so in Arabic they must point the other way.',
  fix: 'Mirror it in RTL with a :dir(rtl) { transform: scaleX(-1) } rule, or swap to the opposite icon.',
  check: (m) => m.icons
    .filter((i) => i.dir === 'rtl' && !i.mirrored && i.name !== null && DIRECTIONAL_ICON.test(i.name))
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

export const iconRules = [notMirrored, mirroredByMistake]
