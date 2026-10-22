import type { IconNode } from '../model'
import { arrowHead, glyphHosts, iconRole } from './arrow'
import { offScreenWithin } from './hidden'
import { flipSign, MIRROR_DEPTH, turns } from './mirror'
import { clean, dirOf, type Pred, type Ref, type Style } from './types'

const ICON_CLASS = /^(lucide-|fa-|icon-|bi-|ri-|ti-|i-)(.+)$/
const ICON_CLASS_SKIP = /^(fa-(solid|regular|light|thin|duotone|brands|sharp)|fa-\d?x|fa-fw|icon-(sm|md|lg))$/
const CANDIDATES = 'svg, img, i, span[class*="icon"], [data-icon], [data-lucide], .material-icons, .material-symbols-outlined'

/** PascalCase and camelCase become kebab-case, then everything is lowercased. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** The aria-label of the nearest button or link, only when the icon is that control's sole visible content. Text or icons that are display:none, visibility:hidden or screen-reader-only do not count; aria-hidden alone still paints, so it does. */
function soleControlLabel(el: Element): string {
  const control = el.closest('button, a')
  const label = clean(control?.getAttribute('aria-label') ?? '')
  if (!control || !label) return ''
  const walker = control.ownerDocument.createTreeWalker(control, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (clean(node.textContent ?? '') && parent && !parent.closest('svg') && !offScreenWithin(parent, control)) return ''
  }
  const others = Array.from(control.querySelectorAll(CANDIDATES)).filter((c) => c !== el && !c.contains(el) && !el.contains(c) && !offScreenWithin(c, control))
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

/**
 * Whether the element or an ancestor (up to 4 deep) mirrors it (a flip: the determinant is negative), and whether one
 * turns it to point the other way without mirroring (rotate(180deg), scale(-1,-1)). Icons treat any flip as mirrored.
 */
function orientation(el: Element, style: Style): { mirrored: boolean; turned: boolean } {
  let mirrored = false
  let turned = false
  let node: Element | null = el
  for (let depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) {
    const s = style(node)
    mirrored ||= flipSign(s) < 0
    turned ||= turns(s)
  }
  return { mirrored, turned }
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
    out.push(iconNode(el, style, ref, iconName(el)))
  }
  // An arrow glyph in a button or link is an icon too. It has no name, so the name-based rules leave it alone.
  const taken = new Set(candidates)
  for (const el of glyphHosts(doc)) {
    if (taken.has(el) || wrappers.has(el) || candidates.some((c) => c.contains(el)) || skipped(el) || !visible(el)) continue
    out.push(iconNode(el, style, ref, null))
  }
  return out
}

function iconNode(el: Element, style: Style, ref: Ref, name: string | null): IconNode {
  const dir = dirOf(style(el))
  return { ...ref(el), name, dir, ...orientation(el, style), head: arrowHead(el, style, dir), role: iconRole(el) }
}
