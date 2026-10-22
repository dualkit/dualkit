import type { ArrowHead, ArrowRole, Direction } from '../model'
import { linearOf, MIRROR_DEPTH, type Linear } from './mirror'
import type { Style } from './types'

// Ported from packages/eval/src/inject-path.ts (pathVertices, pointVertices, headDirection). Keep the two in step.
const ARGS: Readonly<Record<string, number>> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 }
const TOKEN = /([a-zA-Z])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g

export type Point = { readonly x: number; readonly y: number }

/** Absolute vertices of each subpath. Curves and arcs contribute their end points. Empty when the path cannot be read. */
export function pathVertices(d: string): readonly (readonly Point[])[] {
  const tokens = [...d.matchAll(TOKEN)]
  const subpaths: Point[][] = []
  let cur: Point = { x: 0, y: 0 }
  let start = cur
  let i = 0
  const push = (p: Point) => {
    cur = p
    subpaths[subpaths.length - 1]?.push(p)
  }
  while (i < tokens.length) {
    const cmd = tokens[i]![1]
    const size = cmd === undefined ? undefined : ARGS[cmd.toLowerCase()]
    if (cmd === undefined || size === undefined) return []
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    i++
    if (lower === 'z') {
      push(start)
      continue
    }
    let firstPair = true
    while (i < tokens.length && tokens[i]![2] !== undefined) {
      const a = tokens.slice(i, i + size).map((t) => Number(t[2]))
      if (a.length < size || a.some(Number.isNaN)) return []
      i += size
      const ox = rel ? cur.x : 0
      const oy = rel ? cur.y : 0
      if (lower === 'h') push({ x: ox + a[0]!, y: cur.y })
      else if (lower === 'v') push({ x: cur.x, y: oy + a[0]! })
      else {
        const end = { x: ox + a[size - 2]!, y: oy + a[size - 1]! }
        if (lower === 'm' && firstPair) {
          subpaths.push([])
          start = end
        }
        push(end)
      }
      firstPair = false
    }
  }
  return subpaths.filter((s) => s.length > 0)
}

/** The vertices of a polyline points list; a polygon passes closed: true to return to its first point. */
export function pointVertices(points: string, closed = false): readonly (readonly Point[])[] {
  const n = points.trim().split(/[\s,]+/).map(Number)
  const pts: Point[] = []
  for (let k = 0; k + 1 < n.length; k += 2) pts.push({ x: n[k]!, y: n[k + 1]! })
  return [closed && pts.length > 0 ? [...pts, pts[0]!] : pts]
}

/** Which way the arrow head points: the sharpest wide corner of any subpath. Null when no head is found. */
export function headDirection(subpaths: readonly (readonly Point[])[]): ArrowHead | null {
  let best: { span: number; dir: ArrowHead } | null = null
  for (const pts of subpaths) {
    for (let k = 1; k + 1 < pts.length; k++) {
      const [a, b, c] = [pts[k - 1]!, pts[k]!, pts[k + 1]!]
      const span = Math.abs(a.y - c.y)
      const opposite = (a.y - b.y) * (c.y - b.y) < 0
      const dir = a.x > b.x && c.x > b.x ? 'left' : a.x < b.x && c.x < b.x ? 'right' : null
      if (opposite && dir !== null && (best === null || span > best.span)) best = { span, dir }
    }
  }
  return best?.dir ?? null
}

/** The arrow glyphs read as icons, and the way each is drawn in left-to-right text. */
const GLYPHS: Readonly<Record<string, ArrowHead>> = { '←': 'left', '→': 'right', '‹': 'left', '›': 'right', '«': 'left', '»': 'right' }
const ARROW_GLYPHS = /[←→‹›«»]/g
const ARROW_GLYPH = /[←→‹›«»]/
/** Unicode marks these Bidi_Mirrored, so in right-to-left text they are drawn the other way round. */
const BIDI_MIRRORED = new Set(['‹', '›', '«', '»'])

const flip = (head: ArrowHead): ArrowHead => (head === 'left' ? 'right' : 'left')

/** The head of the one arrow glyph in a text, as drawn in text of that direction. Null with none, or two (« » as quotes). */
export function glyphHead(text: string, dir: Direction): ArrowHead | null {
  const found = text.match(ARROW_GLYPHS)
  if (found?.length !== 1) return null
  const glyph = found[0]!
  return dir === 'rtl' && BIDI_MIRRORED.has(glyph) ? flip(GLYPHS[glyph]!) : GLYPHS[glyph]!
}

const BACK_WORDS = new Set(['back', 'prev', 'previous', 'رجوع', 'الرجوع', 'ارجع', 'السابق', 'عودة', 'العودة'])
const FORWARD_WORDS = new Set(['next', 'forward', 'التالي', 'متابعة'])
/** Words that may follow a role word in a name: "back to orders", "الرجوع إلى الخطوة السابقة". */
const TO = new Set(['to', 'إلى', 'الى'])
/** What a role word may step through: "previous month", "الشهر السابق", "nextMonth". */
const UNITS = new Set(['month', 'year', 'week', 'day', 'page', 'step', 'slide', 'الشهر', 'العام', 'الأسبوع', 'اليوم'])
/** What a class or id may call the control after its role word: "back-btn", "back-link". */
const CONTROLS = new Set(['btn', 'button', 'link', 'icon', 'arrow', 'nav'])

type Roles = { back: boolean; forward: boolean }
const roleWord = (w: string | undefined): Roles => ({ back: w !== undefined && BACK_WORDS.has(w), forward: w !== undefined && FORWARD_WORDS.has(w) })
const either = (a: Roles, b: Roles): Roles => ({ back: a.back || b.back, forward: a.forward || b.forward })
const NONE: Roles = { back: false, forward: false }

/**
 * A label or title names a role only as a whole phrase: the role word alone, followed by "to" and a place,
 * or paired with a unit such as a month. A role word inside other words ("الطلبات السابقة", "previous orders") names none.
 */
function nameRoles(name: string): Roles {
  const w = name.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (w.length === 1 || (w.length > 2 && TO.has(w[1]!))) return roleWord(w[0])
  if (w.length !== 2) return NONE
  return UNITS.has(w[1]!) ? roleWord(w[0]) : UNITS.has(w[0]!) ? roleWord(w[1]) : NONE
}

/**
 * A class or id token names a role when it is a role word, ends in one after a separator (swiper-button-prev, nav-back),
 * or is a role word and a control or unit (back-btn, prevMonth). previous-orders, cash-back-offer and back-office name none.
 */
function tokenRoles(token: string): Roles {
  const w = token.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().split(/[-_]+/).filter(Boolean)
  // A token with both kinds of role word (prev-next) says both.
  if (w.some((x) => BACK_WORDS.has(x)) && w.some((x) => FORWARD_WORDS.has(x))) return { back: true, forward: true }
  const paired = w.length === 2 && (CONTROLS.has(w[1]!) || UNITS.has(w[1]!)) ? roleWord(w[0]) : NONE
  return either(roleWord(w[w.length - 1]), paired)
}

/** Back or forward from label and title names, and class and id tokens. Null when they say neither, or both. */
export function roleOf({ names = [], tokens = [] }: { names?: readonly string[]; tokens?: readonly string[] }): ArrowRole | null {
  const r = [...names.map(nameRoles), ...tokens.map(tokenRoles)].reduce(either, NONE)
  return r.back === r.forward ? null : r.back ? 'back' : 'forward'
}

export const CONTROL = 'button, a, [role="button"], [role="link"]'
/** How far up from the icon the button or link may sit. */
const CONTROL_DEPTH = 3

/** The role of an arrow, from the icon's own words and those of every element up to the button or link around it. */
export function iconRole(el: Element): ArrowRole | null {
  const chain: Element[] = [el]
  let control: Element | null = el.matches(CONTROL) ? el : null
  for (let node = el.parentElement, depth = 0; !control && node && depth < CONTROL_DEPTH; depth++, node = node.parentElement) {
    chain.push(node)
    if (node.matches(CONTROL)) control = node
  }
  // Without a control, words further up (a section named "previous orders") say nothing about this icon.
  const named = control ? chain : [el]
  const attr = (n: Element, a: string): string => n.getAttribute(a) ?? ''
  return roleOf({
    names: named.flatMap((n) => [attr(n, 'aria-label'), attr(n, 'title')]),
    tokens: named.flatMap((n) => [...attr(n, 'class').split(/\s+/), attr(n, 'id')]),
  })
}

const times = ([a, b, c, d]: Linear, [e, f, g, h]: Linear): Linear => [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h]

/** The 2D linear part of everything the element and up to 4 ancestors apply, the same chain that reads `mirrored` and `turned`. */
function screenLinear(el: Element, style: Style): Linear {
  let m: Linear = [1, 0, 0, 1]
  for (let node: Element | null = el, depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) m = times(linearOf(style(node)), m)
  return m
}

/** Where a head drawn one way points on screen once the transforms apply. Null when they turn it mostly upright. */
function onScreen(drawn: ArrowHead | null, linear: Linear): ArrowHead | null {
  if (drawn === null) return null
  const [a, b] = linear
  if (Math.abs(a) <= Math.abs(b)) return null
  return a < 0 ? flip(drawn) : drawn
}

const apply = ([a, b, c, d]: Linear, p: Point): Point => ({ x: a * p.x + c * p.y, y: b * p.x + d * p.y })

/** The vertices of one SVG shape in its SVG's coordinates, after the shape's and its groups' transforms. */
function shapeVertices(shape: SVGGraphicsElement): readonly (readonly Point[])[] {
  const tag = shape.tagName.toLowerCase()
  const raw = tag === 'path' ? pathVertices(shape.getAttribute('d') ?? '')
    : tag === 'polyline' || tag === 'polygon' ? pointVertices(shape.getAttribute('points') ?? '', tag === 'polygon')
      : []
  const ctm = typeof shape.getCTM === 'function' ? shape.getCTM() : null
  const linear: Linear = ctm ? [ctm.a, ctm.b, ctm.c, ctm.d] : [1, 0, 0, 1]
  return raw.map((pts) => pts.map((p) => apply(linear, p)))
}

/** The head of an inline SVG arrow as drawn, from its paths, polylines and polygons. */
function svgHead(svg: Element): ArrowHead | null {
  const shapes = Array.from(svg.querySelectorAll('path, polyline, polygon')) as SVGGraphicsElement[]
  return headDirection(shapes.flatMap(shapeVertices))
}

/** The text of the element itself, not of its children. */
const ownText = (el: Element): string =>
  Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('')

/** Where an icon's arrow head points on screen: an inline SVG's drawn head or its own arrow glyph, after CSS transforms. */
export function arrowHead(el: Element, style: Style, dir: Direction): ArrowHead | null {
  const drawn = el.tagName.toLowerCase() === 'svg' ? svgHead(el) : glyphHead(ownText(el), dir)
  return onScreen(drawn, screenLinear(el, style))
}

/** Elements that hold the one arrow glyph of a button or link in their own text, such as <a>←</a>. */
export function glyphHosts(doc: Document): Element[] {
  const out = new Set<Element>()
  for (const control of Array.from(doc.body.querySelectorAll(CONTROL))) {
    if ((control.textContent ?? '').match(ARROW_GLYPHS)?.length !== 1) continue
    const walker = doc.createTreeWalker(control, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const host = node.parentElement
      if (host && !host.closest('svg') && ARROW_GLYPH.test(node.textContent ?? '')) out.add(host)
    }
  }
  return [...out]
}
