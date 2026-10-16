import type { ScreenModel } from '../model'
import { defineRule, pick } from '../rule'
import { ARABIC_FONT, excerpt, hasArabic } from '../text'

export const MIN_ARABIC_LEADING = 1.5
export const MIN_ARABIC_SIZE = 14

const arabicRuns = (m: ScreenModel) => m.texts.filter((t) => hasArabic(t.text))

export const arabicLeading = defineRule({
  id: 'type/arabic-leading', group: 'type', severity: 'warning',
  title: 'Arabic lines set too tight',
  why: 'Arabic has tall ascenders, deep descenders and dots, which clip or collide at Latin line heights.',
  fix: 'Give Arabic body text a line height of about 1.6 to 1.8, for example :lang(ar) { line-height: 1.7 }.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.lineHeight !== null && t.lines >= 2 && t.font.lineHeight / t.font.size < MIN_ARABIC_LEADING)
    .map((t) => ({ node: pick(t), message: `Line height is ${((t.font.lineHeight ?? 0) / t.font.size).toFixed(2)} on "${excerpt(t.text)}".` })),
})

export const arabicTracking = defineRule({
  id: 'type/arabic-tracking', group: 'type', severity: 'error',
  title: 'Letter-spacing on Arabic',
  why: 'Arabic letters join, and letter-spacing pulls the joins apart.',
  fix: 'Set letter-spacing: 0 on Arabic, for example :lang(ar) { letter-spacing: 0 }.',
  check: (m) => arabicRuns(m)
    .filter((t) => Math.abs(t.font.letterSpacing) > 0.01)
    .map((t) => ({ node: pick(t), message: `${t.font.letterSpacing}px letter-spacing on "${excerpt(t.text)}".` })),
})

export const arabicItalic = defineRule({
  id: 'type/arabic-italic', group: 'type', severity: 'warning',
  title: 'Slanted Arabic',
  why: 'Arabic has no italic, so the browser slants the letters, which reads as broken.',
  fix: 'Set font-style: normal on Arabic and use weight or colour for emphasis.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.style !== 'normal')
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is set in ${t.font.style}.` })),
})

export const arabicFont = defineRule({
  id: 'type/arabic-font', group: 'type', severity: 'warning',
  title: 'No Arabic font in the stack',
  why: 'With no Arabic face listed, every device falls back to its own font, so the design looks different everywhere.',
  fix: 'Add an Arabic family to the font stack, for example "IBM Plex Sans Arabic".',
  check: (m) => {
    const seen = new Set<string>()
    return arabicRuns(m)
      .filter((t) => {
        const key = t.font.families.join(',')
        if (seen.has(key) || t.font.families.some((f) => ARABIC_FONT.test(f))) return false
        seen.add(key)
        return true
      })
      .map((t) => ({ node: pick(t), message: `Arabic falls back from ${t.font.families.join(', ')}.` }))
  },
})

export const arabicSize = defineRule({
  id: 'type/arabic-size', group: 'type', severity: 'warning',
  title: 'Arabic set too small',
  why: 'At the same pixel size Arabic reads smaller than Latin, and its dots blur below 14px.',
  fix: 'Keep Arabic UI text at 14px or more, and body text at 16px.',
  check: (m) => arabicRuns(m)
    .filter((t) => t.font.size < MIN_ARABIC_SIZE)
    .map((t) => ({ node: pick(t), message: `"${excerpt(t.text)}" is ${t.font.size}px.` })),
})

export const typeRules = [arabicLeading, arabicTracking, arabicItalic, arabicFont, arabicSize]
