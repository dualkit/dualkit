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
import { mirrorPath, mirrorPoints } from './inject-path.js'
import type { Finder } from './inject-text.js'

const BACK_WORDS = /(^|[^a-z])(back|prev|previous)([^a-z]|$)|رجوع|الرجوع|السابق|العودة/i
const FLIP: Readonly<Record<string, string>> = { '←': '→', '→': '←', '‹': '›', '›': '‹', '«': '»', '»': '«', '❮': '❯', '❯': '❮', '⟵': '⟶', '⟶': '⟵', '◀': '▶', '▶': '◀', '◄': '►', '►': '◄' }
const GLYPH = new RegExp(`[${Object.keys(FLIP).join('')}]`)
const CONTROLS = new Set(['button', 'a', 'div', 'span', 'i'])

const looksLikeBack = (el: HTMLElement) =>
  CONTROLS.has(tagOf(el)) &&
  [el.getAttribute('aria-label'), el.getAttribute('class'), el.getAttribute('id'), el.getAttribute('title')].some((v) => BACK_WORDS.test(v ?? ''))

/** Edits that mirror every shape in an svg, or null when one cannot be mirrored. */
function mirrorSvg(html: string, svg: HTMLElement): readonly Edit[] | null {
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (box.length !== 4 || box.some(Number.isNaN)) return null
  const shapes = svg.querySelectorAll('*').filter((e) => tagOf(e) !== 'title' && tagOf(e) !== 'g')
  if (shapes.length === 0 || shapes.some((s) => !['path', 'polyline'].includes(tagOf(s)))) return null
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
  for (const el of elementsOf(body)) {
    if (!looksLikeBack(el)) continue
    const svg = el.querySelector('svg')
    if (svg) {
      const edits = mirrorSvg(html, svg)
      if (edits) return edits
    }
    const text = el.childNodes.filter(isText).find((t) => GLYPH.test(t.rawText))
    if (text) {
      const flipped = text.rawText.replace(new RegExp(GLYPH.source, 'g'), (c) => FLIP[c] ?? c)
      return [...retag(html, el, 'back-arrow'), textEdit(text, flipped)]
    }
  }
  return null
}

const CODE_BOX = (el: HTMLElement) => tagOf(el) === 'input' && el.getAttribute('maxlength') === '1'
const STRIP = ` pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"`

export const otpDigits: Finder = (html, body) => {
  const inputs = elementsOf(body).filter((e) => tagOf(e) === 'input')
  const boxes = inputs.filter(CODE_BOX)
  const fits = (el: HTMLElement) =>
    !el.hasAttribute('oninput') &&
    (el.getAttribute('autocomplete') === 'one-time-code' || el.getAttribute('inputmode') === 'numeric' || (CODE_BOX(el) && boxes.length >= 4))
  const target = inputs.find(fits)
  return target ? retag(html, target, 'otp-digits', { transform: (rest) => appendAttrs(removeAttr(rest, 'pattern'), STRIP) }) : null
}
