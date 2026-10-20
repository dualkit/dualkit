import type { IconNode } from '../model'
import { flipSign, MIRROR_DEPTH } from './mirror'
import { clean, dirOf, type Pred, type Ref, type Style } from './types'

const ICON_CLASS = /^(lucide-|fa-|icon-|bi-|ri-|ti-|i-)(.+)$/
const ICON_CLASS_SKIP = /^(fa-(solid|regular|light|thin|duotone|brands|sharp)|fa-\d?x|fa-fw|icon-(sm|md|lg))$/
const CANDIDATES = 'svg, img, i, span[class*="icon"], [data-icon], [data-lucide], .material-icons, .material-symbols-outlined'

/** PascalCase and camelCase become kebab-case, then everything is lowercased. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** The aria-label of the nearest button or link, only when the icon is that control's sole visible content. */
function soleControlLabel(el: Element): string {
  const control = el.closest('button, a')
  const label = clean(control?.getAttribute('aria-label') ?? '')
  if (!control || !label) return ''
  const walker = control.ownerDocument.createTreeWalker(control, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (clean(node.textContent ?? '') && !node.parentElement?.closest('svg')) return ''
  }
  const others = Array.from(control.querySelectorAll(CANDIDATES)).filter((c) => c !== el && !c.contains(el) && !el.contains(c))
  return others.length === 0 ? label : ''
}

/** Name sources, best first: data attributes, sprite reference, icon class, glyph text, aria-label, image alt, title, SVG <title>, the aria-label of the button or link around it, image filename. */
export function iconName(el: Element): string | null {
  const data = el.getAttribute('data-icon') ?? el.getAttribute('data-lucide')
  if (data) return kebab(data)
  const useEl = el.tagName.toLowerCase() === 'svg' ? el.querySelector('use') : null
  const use = useEl?.getAttribute('href') ?? useEl?.getAttribute('xlink:href')
  if (use) return kebab(use.replace(/^.*#/, ''))
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).find((c) => ICON_CLASS.test(c) && !ICON_CLASS_SKIP.test(c))
  if (cls) return kebab(cls.replace(ICON_CLASS, '$2'))
  if (/material-(icons|symbols)/.test(el.getAttribute('class') ?? '')) {
    const glyph = clean(el.textContent ?? '')
    if (glyph) return kebab(glyph)
  }
  const label = el.getAttribute('aria-label')
  if (label) return kebab(label)
  const img = el.tagName === 'IMG' ? (el as HTMLImageElement) : null
  if (img?.alt) return kebab(img.alt)
  const own = clean(el.getAttribute('title') ?? '') || clean(el.querySelector(':scope > title')?.textContent ?? '')
  if (own) return kebab(own)
  // A bare icon inside a labelled button or link takes the control's name.
  const control = soleControlLabel(el)
  if (control) return kebab(control)
  if (img) return kebab(img.getAttribute('src')?.split('/').pop()?.replace(/\.\w+$/, '') || '') || null
  return null
}

/** True when the element or an ancestor (up to 4 deep) has a horizontally flipping transform. Icons treat any flip as mirrored. */
function mirrored(el: Element, style: Style): boolean {
  let node: Element | null = el
  for (let depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) {
    if (flipSign(style(node)) < 0) return true
  }
  return false
}

/** Every ancestor of a candidate, so wrappers can be dropped in favour of the innermost icon. */
function ancestorsOf(candidates: Element[]): Set<Element> {
  const out = new Set<Element>()
  for (const el of candidates) {
    for (let node = el.parentElement; node && !out.has(node); node = node.parentElement) out.add(node)
  }
  return out
}

export function readIcons(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): IconNode[] {
  const candidates = Array.from(doc.body.querySelectorAll(CANDIDATES))
  const wrappers = ancestorsOf(candidates)
  const out: IconNode[] = []
  for (const el of candidates) {
    if (wrappers.has(el) || el.parentElement?.closest('svg') || skipped(el) || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 64 || r.height > 64) continue
    out.push({ ...ref(el), name: iconName(el), dir: dirOf(style(el)), mirrored: mirrored(el, style) })
  }
  return out
}
