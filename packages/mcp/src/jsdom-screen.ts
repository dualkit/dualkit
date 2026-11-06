import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { ScreenModel } from '@dualkit/rules'
import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom'

/** The reader dualkit check runs in Chromium: the same script, read once and run inside each jsdom window. */
const READER_PATH = createRequire(import.meta.url).resolve('@dualkit/rules/reader')
let readerSource: string | undefined

/** jsdom does no layout, so every displayed element gets this one box: a full-width line. */
const VIEWPORT_WIDTH = 1280
const LINE_HEIGHT = 20

/** Text in every range clone, so the reader never treats two texts as one word (see cloneContents below). */
const NOT_READ = '⁣'
const TEXT_NODE = 3
const DOCUMENT_NODE = 9
const DOCTYPE_NODE = 10

const RTL_CHAR =/[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CHAR = /[A-Za-zÀ-ɏ]/

type BoxLike = { x: number; y: number; left: number; top: number; right: number; bottom: number; width: number; height: number }
const box = (shown: boolean): BoxLike => {
  const width = shown ? VIEWPORT_WIDTH : 0
  const height = shown ? LINE_HEIGHT : 0
  return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height }
}

/** dir="auto" takes the direction of the first strong letter, as the HTML standard says. */
function autoDirection(el: Element): 'ltr' | 'rtl' | null {
  const value = el instanceof el.ownerDocument.defaultView!.HTMLInputElement ? el.value : el.textContent ?? ''
  for (const ch of value) {
    if (RTL_CHAR.test(ch)) return 'rtl'
    if (LTR_CHAR.test(ch)) return 'ltr'
  }
  return null
}

/**
 * Gives a jsdom window what the reader needs from a browser and jsdom lacks: the inherited `direction` (from CSS or
 * the dir attribute), a box for every displayed element, text ranges with a box, the viewport width and an empty font
 * set. Measurements built on these boxes are not real, which is why the rules that need them are not run.
 */
function shimBrowser(window: DOMWindow): void {
  const computed = window.getComputedStyle.bind(window)
  const styles = new WeakMap<Element, Map<string, CSSStyleDeclaration>>()
  const style = (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
    const key = pseudo ?? ''
    const known = styles.get(el)?.get(key)
    if (known) return known
    const s = computed(el, pseudo)
    styles.set(el, (styles.get(el) ?? new Map()).set(key, s))
    return s
  }
  const shownMemo = new WeakMap<Element, boolean>()
  const shown = (el: Element): boolean => {
    const known = shownMemo.get(el)
    if (known !== undefined) return known
    const result = el.isConnected && style(el).display !== 'none' && (el.parentElement === null || shown(el.parentElement))
    shownMemo.set(el, result)
    return result
  }
  const dirMemo = new WeakMap<Element, 'ltr' | 'rtl'>()
  const direction = (el: Element): 'ltr' | 'rtl' => {
    const known = dirMemo.get(el)
    if (known) return known
    const own = style(el).direction
    const attr = (el.getAttribute('dir') ?? '').toLowerCase()
    const result = own === 'rtl' || own === 'ltr' ? own
      : attr === 'rtl' || attr === 'ltr' ? attr
        : (attr === 'auto' && autoDirection(el)) || (el.parentElement ? direction(el.parentElement) : 'ltr')
    dirMemo.set(el, result)
    return result
  }

  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    const s = style(el, pseudo)
    return new Proxy(s, {
      get: (target, prop) => {
        if (prop === 'direction') return direction(el)
        const value: unknown = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }) as typeof window.getComputedStyle

  window.Element.prototype.getBoundingClientRect = function (this: Element) { return box(shown(this)) as DOMRect }
  window.Range.prototype.getBoundingClientRect = function (this: Range) {
    const node = this.commonAncestorContainer
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement
    return box(el !== null && shown(el)) as DOMRect
  }
  window.Range.prototype.getClientRects = function (this: Range) { return [this.getBoundingClientRect()] as unknown as DOMRectList }
  // The reader clones a range only to find split Arabic words, for type/arabic-broken-join, which needs painted letter
  // positions and so is not checked here. In jsdom each clone walks every child of the two texts' common ancestor, which
  // makes a minified page cost its square. A clone that is never empty tells the reader there is a gap, so it moves on.
  window.Range.prototype.cloneContents = function (this: Range) {
    const gap = window.document.createDocumentFragment()
    gap.append(window.document.createTextNode(NOT_READ))
    return gap
  }
  // A new range sits at the start of the document, and jsdom orders a boundary point by walking the tree from there,
  // so setStart on a fresh range costs the whole page. Moving the range onto the node first is cheap and leaves the
  // same range once setStart and setEnd have run.
    const setStart = window.Range.prototype.setStart
  window.Range.prototype.setStart = function (this: Range, node: Node, offset: number) {
    if (this.collapsed && this.startContainer.nodeType === DOCUMENT_NODE && node.nodeType !== DOCTYPE_NODE) this.selectNodeContents(node)
    return setStart.call(this, node, offset)
  }
  // The reader ends a range in another node only between two texts for type/arabic-broken-join, which the clone above
  // already answers. Ordering two far-apart nodes walks the tree between them, so that range stays where it starts.
  const setEnd = window.Range.prototype.setEnd
  window.Range.prototype.setEnd = function (this: Range, node: Node, offset: number) {
    if (this.collapsed && this.startContainer.nodeType === TEXT_NODE && this.startContainer !== node) return
    return setEnd.call(this, node, offset)
  }
  Object.defineProperty(window.document.documentElement, 'clientWidth', { get: () => VIEWPORT_WIDTH })
  Object.defineProperty(window.document, 'fonts', { value: { ready: Promise.resolve(), [Symbol.iterator]: function* () { /* jsdom loads no fonts */ } } })
}

/**
 * Parses the HTML in jsdom with scripts off and no subresources fetched, then runs the @dualkit/rules reader on it.
 * Boxes, fonts and transforms in the model are placeholders: only the rules in JSDOM_CHECKED may read it.
 */
export function readHtml(html: string): ScreenModel {
  readerSource ??= readFileSync(READER_PATH, 'utf8')
  // The window is left for the garbage collector, not closed: no script runs and no timer is set, and close() empties
  // the page node by node against every range the reader made, which costs seconds on a large page.
  const { window } = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() })
  shimBrowser(window)
  window.eval(readerSource)
  const reader = (window as unknown as { dualkitReader: { readScreen: (d: Document) => ScreenModel } }).dualkitReader
  return reader.readScreen(window.document)
}
