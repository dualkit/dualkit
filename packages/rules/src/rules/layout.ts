import type { LayoutNode } from '../model'
import { defineRule, pick, type Hit } from '../rule'
import { excerpt, isArabicScriptLang } from '../text'

/** Under this many Arabic words a block is a label, such as a language switcher, not a paragraph. */
const MIN_ARABIC_WORDS = 3

const SPACING = /^(margin|padding)-(left|right)$/

const firstPhysical = (layouts: LayoutNode[], match: (property: string) => boolean): Hit[] =>
  layouts
    .filter((l) => l.dir === 'rtl')
    .flatMap((l) => {
      const p = l.physical.find((d) => match(d.property))
      return p ? [{ node: pick(l), message: `${p.property}: ${p.value} stays on the same side in Arabic.` }] : []
    })

export const physicalSpacing = defineRule({
  id: 'layout/physical-spacing', group: 'layout', severity: 'warning',
  title: 'Spacing that does not mirror',
  why: 'margin-left and padding-right stay put when the layout flips, so gaps end up on the wrong side.',
  fix: 'Use margin-inline-start, padding-inline-end and the other logical properties.',
  check: (m) => firstPhysical(m.layouts, (p) => SPACING.test(p)),
})

export const physicalInset = defineRule({
  id: 'layout/physical-inset', group: 'layout', severity: 'warning',
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
    .filter((l) => l.dir === 'rtl' && l.hasOwnText && l.hasArabicText && l.textAlign === 'left')
    .map((l) => ({ node: pick(l), message: 'This right-to-left text is aligned left.' })),
})

export const arabicLtrBlock = defineRule({
  id: 'layout/arabic-ltr-block', group: 'layout', severity: 'error',
  title: 'Arabic laid out left to right',
  why: 'A mostly Arabic paragraph in a left-to-right box starts on the wrong side and puts its punctuation at the wrong end.',
  fix: 'Set dir="rtl" on the page or the element, and lang="ar".',
  check: (m) => {
    const seen = new Set<string>()
    // A run tagged with an Arabic-script lang in a page in another language is an isolated label.
    const taggedLabel = (lang: string | null) => isArabicScriptLang(lang) && !isArabicScriptLang(m.root.lang)
    return m.texts
      .filter((t) => t.blockDir === 'ltr' && !taggedLabel(t.lang) && t.blockArabicShare > 0.5 && t.blockArabicWords >= MIN_ARABIC_WORDS)
      .filter((t) => !seen.has(t.blockId) && Boolean(seen.add(t.blockId)))
      .map((t) => ({ node: pick(t), message: `"${excerpt(t.blockText)}" is laid out left to right.` }))
  },
})

export const layoutRules = [physicalSpacing, physicalInset, textAlignLeft, arabicLtrBlock]
