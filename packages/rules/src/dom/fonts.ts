import type { LoadedFace } from '../model'

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

/** Every font face the page declares, with whether it has loaded. */
export function readFonts(doc: Document): LoadedFace[] {
  const adjust = sizeAdjusts(doc)
  return Array.from(doc.fonts).map((f) => {
    const family = f.family.replace(/^["']|["']$/g, '')
    const own = (f as FontFace & { sizeAdjust?: string }).sizeAdjust
    return {
      family, weight: weightRange(f.weight), style: f.style, unicodeRange: f.unicodeRange,
      sizeAdjust: own !== undefined ? ratio(own) : (adjust.get(`${family}|${f.weight}`) ?? 1),
      status: f.status,
    }
  })
}
