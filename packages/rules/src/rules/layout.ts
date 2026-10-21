import type { LayoutNode } from '../model'
import { defineRule, pick, type Hit } from '../rule'
import { excerpt, hasArabic } from '../text'

/** Under this many Arabic words a block is a label, such as a language switcher, not a paragraph. */
const MIN_ARABIC_WORDS = 3

/** Text must sit at least this many px short of its box for text-align to show. */
const MIN_TEXT_SLACK = 4

const SPACING = /^(margin|padding)-(left|right)$/

const firstPhysical = (layouts: LayoutNode[], match: (property: string) => boolean): Hit[] =>
  layouts
    .filter((l) => l.dir === 'rtl')
    .flatMap((l) => {
      const p = l.physical.find((d) => match(d.property))
      return p ? [{ node: pick(l), message: `${p.property}: ${p.value} stays on the same side in Arabic.` }] : []
    })

export const physicalSpacing = defineRule({
  id: 'layout/physical-spacing', group: 'layout', severity: 'note',
  title: 'Spacing that does not mirror',
  why: 'margin-left and padding-right stay put when the layout flips, so gaps end up on the wrong side.',
  fix: 'Use margin-inline-start, padding-inline-end and the other logical properties.',
  check: (m) => firstPhysical(m.layouts, (p) => SPACING.test(p)),
})

export const physicalInset = defineRule({
  id: 'layout/physical-inset', group: 'layout', severity: 'note',
  title: 'Position, float or border that does not mirror',
  why: 'left, right, float and one-sided borders or corners stay on the same side when the layout flips.',
  fix: 'Use inset-inline-start, float: inline-start, border-inline-start and border-start-start-radius.',
  check: (m) => firstPhysical(m.layouts, (p) => !SPACING.test(p)),
})

export const textAlignLeft = defineRule({
  id: 'layout/text-align-left', group: 'layout', severity: 'error',
  title: 'Arabic text forced to the left',
  why: 'text-align: left pins right-to-left text to the wrong edge.',
  fix: 'Use text-align: start.',
  check: (m) => m.layouts
    .filter((l) => l.dir === 'rtl' && l.hasOwnText && l.hasArabicText && l.textAlign === 'left' && l.textSlack >= MIN_TEXT_SLACK)
    .map((l) => ({ node: pick(l), message: 'This right-to-left text is aligned left.' })),
})

export const arabicLtrBlock = defineRule({
  id: 'layout/arabic-ltr-block', group: 'layout', severity: 'error',
  title: 'Arabic laid out left to right',
  why: 'A mostly Arabic paragraph in a left-to-right box starts on the wrong side and puts its punctuation at the wrong end.',
  fix: 'Set dir="rtl" on the page or the element, and lang="ar".',
  check: (m) => {
    const seen = new Set<string>()
    // lang="ar" does not lay text out right to left, so a tagged paragraph still counts; the word minimum skips labels.
    return m.texts
      .filter((t) => t.blockDir === 'ltr' && t.blockArabicShare > 0.5 && t.blockArabicWords >= MIN_ARABIC_WORDS)
      .filter((t) => !seen.has(t.blockId) && Boolean(seen.add(t.blockId)))
      .map((t) => ({ node: pick(t), message: `"${excerpt(t.blockText)}" is laid out left to right.` }))
  },
})

/** Under this many pixels cut off, the gap is rounding, not lost text. */
const MIN_CLIPPED = 2

export const mirroredText = defineRule({
  id: 'layout/mirrored-text', group: 'layout', severity: 'error',
  title: 'Text flipped with the layout',
  why: 'A scaleX(-1) on a container mirrors its letters too, so Arabic reads backwards. Only icons and artwork should flip. A turn such as rotate(180deg) does not mirror, so it is not counted.',
  fix: 'Flip the icon or image alone, and leave the text outside the transform.',
  check: (m) => {
    const seen = new Set<string>()
    return m.texts
      .filter((t) => t.mirrored && hasArabic(t.text) && !seen.has(t.mirroredBy ?? t.id) && Boolean(seen.add(t.mirroredBy ?? t.id)))
      .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is drawn mirrored by a flip.` }))
  },
})

export const clippedText = defineRule({
  id: 'layout/clipped-text', group: 'layout', severity: 'warning',
  title: 'Arabic text cut off by its box',
  why: 'A fixed-size box with overflow hidden cuts off Arabic text that runs long or sits tall, such as a label wider than its button or dots below a tight line.',
  fix: 'Let the box grow with min-width or min-height, or add text-overflow: ellipsis if shortening is intended.',
  check: (m) => m.clips
    .filter((c) => c.hasArabic && !c.ellipsis && c.hidden > MIN_CLIPPED)
    .map((c) => ({ node: pick(c), message: `${Math.round(c.hidden)}px of this text is cut off ${c.axis === 'x' ? 'sideways' : 'at the bottom'}.` })),
})

export const layoutRules = [physicalSpacing, physicalInset, textAlignLeft, arabicLtrBlock, mirroredText, clippedText]
