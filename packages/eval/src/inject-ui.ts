import type { HTMLElement } from 'node-html-parser'
import {
  appendAttrs,
  openTagEnd,
  elementsOf,
  isText,
  removeAttr,
  retag,
  tagOf,
  textEdit,
  type Edit,
} from './inject-html.js'
import { headDirection, mirrorPath, mirrorPoints, pathVertices, pointVertices } from './inject-path.js'
import { flippedBetween, rulesOf, type Rule } from './inject-style.js'
import type { Finder } from './inject-text.js'

const BACK_WORDS = /(^|[^a-z])(back|prev|previous)([^a-z]|$)|رجوع|الرجوع|السابق|العودة/i
const FLIP: Readonly<Record<string, string>> = { '←': '→', '→': '←', '‹': '›', '›': '‹', '«': '»', '»': '«', '❮': '❯', '❯': '❮', '⟵': '⟶', '⟶': '⟵', '◀': '▶', '▶': '◀', '◄': '►', '►': '◄' }
const GLYPH = new RegExp(`[${Object.keys(FLIP).join('')}]`)
const CONTROLS = new Set(['button', 'a', 'div', 'span', 'i'])

const RIGHT = new Set('→›»▶❯⟶►')
// The bidi algorithm mirrors these when they sit in right-to-left text, so they are drawn the other way round.
const MIRRORED = new Set('‹›«»❮❯')

function glyphPointsRight(glyph: string, control: HTMLElement, rules: readonly Rule[]): boolean {
  const drawnRight = RIGHT.has(glyph) !== MIRRORED.has(glyph)
  return drawnRight !== flippedBetween(control, control, rules)
}

const looksLikeBack = (el: HTMLElement) =>
  CONTROLS.has(tagOf(el)) &&
  [el.getAttribute('aria-label'), el.getAttribute('class'), el.getAttribute('id'), el.getAttribute('title')].some((v) => BACK_WORDS.test(v ?? ''))

/** Edits that mirror every shape in an svg, or null when one cannot be mirrored. */
function mirrorSvg(html: string, svg: HTMLElement, control: HTMLElement, rules: readonly Rule[]): readonly Edit[] | null {
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (box.length !== 4 || box.some(Number.isNaN)) return null
  const shapes = svg.querySelectorAll('*').filter((e) => tagOf(e) !== 'title' && tagOf(e) !== 'g')
  if (shapes.length === 0 || shapes.some((s) => !['path', 'polyline'].includes(tagOf(s)))) return null
  if (svg.querySelector('[transform]') || svg.hasAttribute('transform')) return null
  const drawn = headDirection(shapes.flatMap((s) => (tagOf(s) === 'path' ? pathVertices(s.getAttribute('d') ?? '') : pointVertices(s.getAttribute('points') ?? ''))))
  // Only break an arrow that now points right, the way a back arrow should in RTL, after any CSS flip.
  if (drawn === null || (drawn === 'right') === flippedBetween(svg, control, rules)) return null
  const edits = shapes.map((s) => mirrorShape(html, s, box[0]!, box[2]!))
  const changed = edits.every((e) => e !== null) && edits.some((e) => e!.changed)
  return changed ? [...retag(html, svg, 'back-arrow'), ...edits.flatMap((e) => e!.edits)] : null
}

function mirrorShape(html: string, shape: HTMLElement, minX: number, width: number): { edits: Edit[]; changed: boolean } | null {
  const attr = tagOf(shape) === 'path' ? 'd' : 'points'
  const value = shape.getAttribute(attr)
  const next = value === undefined ? null : attr === 'd' ? mirrorPath(value, minX, width) : mirrorPoints(value, minX, width)
  if (next === null) return null
  const start = shape.range[0]
  const end = openTagEnd(html, start)
  const open = html.slice(start, end)
  const pattern = new RegExp(`(\\s${attr}\\s*=\\s*)(["'])[\\s\\S]*?\\2`, 'i')
  if (!pattern.test(open)) return null
  const text = open.replace(pattern, (_m, eq: string, q: string) => `${eq}${q}${next}${q}`)
  const back = attr === 'd' ? mirrorPath(next, minX, width) : mirrorPoints(next, minX, width)
  // A symmetric shape mirrors onto itself, which would be no bug at all.
  return { edits: [{ start, end, text }], changed: back !== next }
}

export const backArrow: Finder = (html, body) => {
  const rules = rulesOf(html)
  for (const el of elementsOf(body)) {
    if (!looksLikeBack(el)) continue
    const svg = el.querySelector('svg')
    if (svg) {
      const edits = mirrorSvg(html, svg, el, rules)
      if (edits) return edits
    }
    const text = el.childNodes.filter(isText).find((t) => GLYPH.test(t.rawText))
    if (text && glyphPointsRight(text.rawText.match(GLYPH)![0], el, rules)) {
      const flipped = text.rawText.replace(new RegExp(GLYPH.source, 'g'), (c) => FLIP[c] ?? c)
      return [...retag(html, el, 'back-arrow'), textEdit(text, flipped)]
    }
  }
  return null
}

const OTP_SCREEN = /otp|one-time|رمز التحقق|رمز التأكيد|كود التحقق|رمز المرور|verification code/i
const CODE_BOX = (el: HTMLElement) => tagOf(el) === 'input' && el.getAttribute('maxlength') === '1'
const STRIP = ` pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"`

export const otpDigits: Finder = (html, body) => {
  const inputs = elementsOf(body).filter((e) => tagOf(e) === 'input')
  const boxes = inputs.filter(CODE_BOX)
  const otpScreen = OTP_SCREEN.test(body.textContent) || inputs.some((e) => OTP_SCREEN.test(`${e.getAttribute('name')} ${e.getAttribute('id')} ${e.getAttribute('class')}`))
  const strong = (el: HTMLElement) =>
    el.getAttribute('autocomplete') === 'one-time-code' || (CODE_BOX(el) && boxes.length >= 4)
  // Numeric keypad inputs are everywhere (phones, card numbers). They only count on a screen that asks for a code.
  const fits = (el: HTMLElement) => !el.hasAttribute('oninput') && (strong(el) || (otpScreen && el.getAttribute('inputmode') === 'numeric'))
  const target = inputs.find((e) => fits(e) && strong(e)) ?? inputs.find(fits)
  return target ? retag(html, target, 'otp-digits', { transform: (rest) => appendAttrs(removeAttr(rest, 'pattern'), STRIP) }) : null
}
