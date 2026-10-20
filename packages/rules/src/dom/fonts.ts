import type { LoadedFace } from '../model'
import { defaultRange } from '../fonts'
import { ARABIC_FAMILY_NAME } from '../text'

const WEIGHTS: Record<string, number> = { normal: 400, bold: 700 }
const weightOf = (v: string): number => WEIGHTS[v] ?? (parseFloat(v) || 400)

function weightRange(raw: string): [number, number] {
  const parts = raw.trim().split(/\s+/)
  const lo = weightOf(parts[0] ?? 'normal')
  return [lo, parts.length > 1 ? weightOf(parts[1]!) : lo]
}

const ratio = (v: string | undefined): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) && n > 0 ? n / 100 : 1
}

/** size-adjust per family and weight, read from the author's @font-face rules (FontFace does not expose it everywhere). */
function sizeAdjusts(doc: Document): Map<string, number> {
  const out = new Map<string, number>()
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, '').trim()
        out.set(`${family}|${rule.style.getPropertyValue('font-weight').trim() || 'normal'}`, ratio(rule.style.getPropertyValue('size-adjust')))
      } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try { visit(sheet.cssRules) } catch { /* cross-origin sheet: size-adjust stays 1 */ }
  }
  return out
}

const ALEF = '\u0627'
/** Unassigned in every version of Unicode, so a family draws it as its missing-glyph box. */
const UNASSIGNED = String.fromCodePoint(0x378)
const PROBE_SIZE = 48
const TOLERANCE = 0.5

const quoted = (family: string): string => `"${family.replace(/["\\]/g, '\\$&')}"`

/**
 * Whether the face draws alef itself, measured as src/dom/signs.ts measures currency signs. Alef is set in the family
 * with a generic fallback and compared with (a) U+0378 in the same stack, the family's missing-glyph box, and (b) alef
 * in the fallback alone. A family without alef paints exactly the fallback's alef, so it draws Arabic only when it
 * differs from both; serif is asked as well, so a glyph that happens to match sans-serif is not missed. Null when the
 * probe cannot run. The probe is removed in finally.
 */
function measureArabic(doc: Document, face: Pick<LoadedFace, 'family' | 'weight' | 'style'>): boolean | null {
  let probe: HTMLElement | null = null
  try {
    probe = doc.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;letter-spacing:0;font-size:${PROBE_SIZE}px`
    probe.style.fontWeight = String(face.weight[0])
    probe.style.fontStyle = face.style
    doc.body.appendChild(probe)
    const el = probe
    const width = (ch: string, family: string): number => {
      el.style.fontFamily = family
      el.textContent = ch
      return el.getBoundingClientRect().width
    }
    const family = quoted(face.family)
    const alef = width(ALEF, `${family},sans-serif`)
    if (Math.abs(alef - width(UNASSIGNED, `${family},sans-serif`)) <= TOLERANCE) return false
    const differs = (generic: string): boolean => Math.abs(width(ALEF, `${family},${generic}`) - width(ALEF, generic)) > TOLERANCE
    return differs('sans-serif') || differs('serif')
  } catch {
    return null
  } finally {
    probe?.remove()
  }
}

/**
 * Every font face the page declares, with whether it has loaded. A loaded face with the default unicode-range whose name
 * does not say Arabic is measured for alef, so brand fonts such as GE SS Two count; the name is the fast path.
 */
export function readFonts(doc: Document): LoadedFace[] {
  const adjust = sizeAdjusts(doc)
  const measured = new Map<string, boolean | null>()
  return Array.from(doc.fonts).map((f) => {
    const family = f.family.replace(/^["']|["']$/g, '')
    const own = (f as FontFace & { sizeAdjust?: string }).sizeAdjust
    const face = {
      family, weight: weightRange(f.weight), style: f.style, unicodeRange: f.unicodeRange,
      sizeAdjust: own !== undefined ? ratio(own) : (adjust.get(`${family}|${f.weight}`) ?? 1),
      status: f.status,
    }
    let drawsArabic: boolean | null = null
    if (f.status === 'loaded' && defaultRange(face) && !ARABIC_FAMILY_NAME.test(family) && doc.body) {
      const key = `${family.toLowerCase()}|${face.weight[0]}|${face.style}`
      if (!measured.has(key)) measured.set(key, measureArabic(doc, face))
      drawsArabic = measured.get(key) ?? null
    }
    return { ...face, drawsArabic }
  })
}
