import type { ScreenModel } from '../model'
import { defineRule, pick } from '../rule'
import { effectiveSize, loadedArabicFace, webfontFamily, coversArabic } from '../fonts'
import { ARABIC_FAMILY_NAME, excerpt, hasArabic, isSystemArabicFont } from '../text'

export const MIN_ARABIC_LEADING = 1.5
export const MIN_ARABIC_SIZE = 14
/** Chromium synthesises bold only when the matched face is lighter than this and the run asks for this or more (measured in verify.test.ts). */
const SYNTHETIC_BOLD_BELOW = 600

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
  fix: 'Load an Arabic family with @font-face or a font link and name it in the stack, for example "IBM Plex Sans Arabic".',
  // Face statuses are judged after the loaders' document.fonts.ready wait.
  check: (m) => {
    const seen = new Set<string>()
    return arabicRuns(m).flatMap((t) => {
      const key = t.font.families.join(',')
      if (seen.has(key)) return []
      seen.add(key)
      if (loadedArabicFace(t.font.families, m.fonts) || t.font.families.some(isSystemArabicFont)) return []
      const named = t.font.families.find((f) => ARABIC_FAMILY_NAME.test(f))
      // The loaders wait FONT_WAIT_MS (3 seconds) for document.fonts.ready, so a face still loading was slow, not missing.
      const loading = named !== undefined && m.fonts.some((f) => f.family.toLowerCase() === named.toLowerCase() && f.status === 'loading')
      const message = named === undefined
        ? `Arabic falls back from ${t.font.families.join(', ')}.`
        : loading ? `"${named}" had not finished loading within 3 seconds.` : `"${named}" is named but never loaded.`
      return [{ node: pick(t), message }]
    })
  },
})

export const arabicSize = defineRule({
  id: 'type/arabic-size', group: 'type', severity: 'warning',
  title: 'Arabic set too small',
  why: 'At the same pixel size Arabic reads smaller than Latin, and its dots blur below 14px.',
  fix: 'Keep Arabic UI text at 14px or more, and body text at 16px.',
  check: (m) => arabicRuns(m).flatMap((t) => {
    const size = effectiveSize(t, m.fonts)
    if (size >= MIN_ARABIC_SIZE) return []
    const shown = Math.round(size * 100) / 100
    const message = size === t.font.size ? `"${excerpt(t.text)}" is ${t.font.size}px.` : `"${excerpt(t.text)}" is ${t.font.size}px, which is ${shown}px after the font's size-adjust.`
    return [{ node: pick(t), message }]
  }),
})

export const arabicFauxBold = defineRule({
  id: 'type/arabic-faux-bold', group: 'type', severity: 'warning',
  title: 'Arabic bold is faked',
  why: 'When no bold face is loaded the browser smears the regular one to fake bold, which blurs Arabic joins and dots.',
  fix: 'Load a real bold face for the Arabic family, for example an @font-face at font-weight 700.',
  check: (m) => {
    const seen = new Set<string>()
    return arabicRuns(m).flatMap((t) => {
      const family = webfontFamily(t.font.families, m.fonts)
      if (family === null || t.font.weight < 600) return []
      // An Arabic system font listed first may be the one painted, and it brings its own bold.
      if (t.font.families.slice(0, t.font.families.indexOf(family)).some(isSystemArabicFont)) return []
      const faces = m.fonts.filter((f) => f.family.toLowerCase() === family.toLowerCase() && f.status === 'loaded' && coversArabic(f))
      const key = `${family.toLowerCase()}|${t.font.weight}`
      if (faces.length === 0 || faces.some((f) => f.weight[1] >= SYNTHETIC_BOLD_BELOW) || seen.has(key)) return []
      seen.add(key)
      return [{ node: pick(t), message: `"${family}" is set at weight ${t.font.weight}, but the heaviest loaded face is ${Math.max(...faces.map((f) => f.weight[1]))}, so the browser fakes the bold.` }]
    })
  },
})

export const arabicBrokenJoin = defineRule({
  id: 'type/arabic-broken-join', group: 'type', severity: 'error',
  title: 'Arabic word split by a box',
  why: 'An inline-block or inline-flex box, and on some platforms a change of font, shapes the text on its own, so the letters on either side stop joining and the word reads as two.',
  fix: 'Keep the word in one inline element, or style the whole word. Colour, bold and padding on an inline span keep the join, but a font change can break it.',
  check: (m) => m.joins.map((j) => ({
    node: pick(j),
    message: j.reason === 'font-family'
      ? `"${excerpt(j.word)}" changes font inside the word, and the browser painted its letters apart.`
      : `"${excerpt(j.word)}" is split by ${j.reason === 'inline-block' ? 'an inline-block' : 'an inline-flex'} box, so its letters do not join.`,
  })),
})

export const typeRules = [arabicLeading, arabicTracking, arabicItalic, arabicFont, arabicSize, arabicFauxBold, arabicBrokenJoin]
