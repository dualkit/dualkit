import type { Font, LoadedFace, SignProbe } from '../model'
import { webfontFamily } from '../fonts'

/** The Saudi riyal, UAE dirham and Omani rial signs, all newer than most fonts. */
const NEW_SIGNS = [0x20c1, 0x20c3, 0x20c4]
/** Unassigned in every version of Unicode, so a family draws it as its missing-glyph box. */
const UNASSIGNED = String.fromCodePoint(0x378)
const PROBE_SIZE = 48
const TOLERANCE = 0.5

const quoted = (family: string): string => `"${family.replace(/["\\]/g, '')}"`

/**
 * For each new currency sign in the text, whether the run's own webfont draws it. The sign is set in the page's
 * declared families alone, with no fallback in the stack, and its width is compared with (b) U+0378 in the same
 * stack, which is the family's missing-glyph box, and (c) the sign in plain sans-serif, which is the system fallback.
 * It is drawn by the webfont only when it differs from both. Runs without a sign return [] and cost nothing.
 */
export function readSigns(doc: Document, text: string, font: Font, fonts: LoadedFace[]): SignProbe[] {
  const present = NEW_SIGNS.filter((cp) => text.includes(String.fromCodePoint(cp)))
  if (present.length === 0) return []
  const declared = font.families.filter((f) => webfontFamily([f], fonts) !== null)
  if (declared.length === 0) return present.map((codePoint) => ({ codePoint, drawnByWebfont: false }))
  const probe = doc.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;letter-spacing:0;font-size:${PROBE_SIZE}px;font-weight:${font.weight};font-style:${font.style}`
  doc.body.appendChild(probe)
  const width = (ch: string, family: string): number => {
    probe.style.fontFamily = family
    probe.textContent = ch
    return probe.getBoundingClientRect().width
  }
  try {
    const stack = declared.map(quoted).join(',')
    const box = width(UNASSIGNED, stack)
    return present.map((codePoint) => {
      const ch = String.fromCodePoint(codePoint)
      const drawn = width(ch, stack)
      return { codePoint, drawnByWebfont: Math.abs(drawn - box) > TOLERANCE && Math.abs(drawn - width(ch, 'sans-serif')) > TOLERANCE }
    })
  } finally {
    probe.remove()
  }
}
