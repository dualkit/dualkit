import type { Node } from '@babel/types'
import type { DefaultTreeAdapterMap } from 'parse5'
import { visit } from '../ast'
import type { LintHit, LintRule, SourceFile } from '../types'

type HtmlNode = DefaultTreeAdapterMap['node']

// dualkit-disable-next-line source/old-rial-sign -- the sign this rule looks for
const SIGN = '﷼'
const SIGN_CODE = 0xfdfc
const MESSAGE = 'U+FDFC is the rial sign, a ligature of the Persian word ریال, not the Saudi riyal sign.'
const SKIPPED_HTML = new Set(['script', 'style'])

/** &#xFDFC; and &#65020; in any case and with any number of leading zeros. */
const NUMERIC_REFERENCE = /&#(?:x([0-9a-f]+)|([0-9]+));/gi
/** A CSS escape: a backslash and one to six hex digits. */
const CSS_ESCAPE = /\\([0-9a-f]{1,6})/gi

/** How many backslashes sit directly before index. An odd number means the backslash at index is itself escaped. */
function backslashesBefore(text: string, index: number): number {
  let n = 0
  while (text[index - 1 - n] === '\\') n++
  return n
}

const count = (text: string): number => text.split(SIGN).length - 1

/** Offsets of the raw sign in source, and of each numeric reference to it when references are decoded. */
function rawOffsets(source: string, decodeReferences: boolean): number[] {
  const out: number[] = []
  for (let i = source.indexOf(SIGN); i !== -1; i = source.indexOf(SIGN, i + 1)) out.push(i)
  if (decodeReferences) {
    for (const m of source.matchAll(NUMERIC_REFERENCE)) {
      if (Number.parseInt(m[1] ?? m[2]!, m[1] ? 16 : 10) === SIGN_CODE) out.push(m.index!)
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Hits for one piece of source whose decoded value is cooked. Every raw sign or reference is reported where it
 * stands. A sign that arrives through a JS escape has no place of its own, so it is reported at the start.
 */
function hitsIn(source: string, cooked: string, start: number, decodeReferences: boolean): LintHit[] {
  const found = rawOffsets(source, decodeReferences)
  const offsets = found.map((i) => start + i)
  if (count(cooked) > found.length) offsets.unshift(start)
  return offsets.map((offset) => ({ offset, message: MESSAGE }))
}

function jsHits(file: SourceFile): LintHit[] {
  const hits: LintHit[] = []
  for (const block of file.js) {
    const at = (node: Node, cooked: string | null | undefined, references: boolean): void => {
      if (!cooked?.includes(SIGN) || node.start == null || node.end == null) return
      const from = block.offset + node.start
      hits.push(...hitsIn(file.text.slice(from, block.offset + node.end), cooked, from, references))
    }
    visit(block.ast.program, (node, parent) => {
      if (node.type === 'StringLiteral') at(node, node.value, parent?.type === 'JSXAttribute')
      else if (node.type === 'TemplateElement') at(node, node.value.cooked, false)
      else if (node.type === 'JSXText') at(node, node.value, true)
    })
  }
  return hits
}

function htmlHits(node: HtmlNode, text: string): LintHit[] {
  const hits: LintHit[] = []
  if (node.nodeName === '#text' && 'value' in node) {
    const loc = node.sourceCodeLocation
    if (loc && node.value.includes(SIGN)) hits.push(...hitsIn(text.slice(loc.startOffset, loc.endOffset), node.value, loc.startOffset, true))
    return hits
  }
  if ('tagName' in node) {
    if (SKIPPED_HTML.has(node.tagName)) return hits
    for (const attr of node.attrs) {
      const loc = node.sourceCodeLocation?.attrs?.[attr.name]
      if (loc && attr.value.includes(SIGN)) hits.push(...hitsIn(text.slice(loc.startOffset, loc.endOffset), attr.value, loc.startOffset, true))
    }
  }
  if ('childNodes' in node) for (const child of node.childNodes) hits.push(...htmlHits(child, text))
  if ('content' in node) hits.push(...htmlHits(node.content, text))
  return hits
}

/** The block's CSS with every comment blanked out, so a sign in a comment is never read. */
function withoutComments(css: string, root: import('postcss').Root): string {
  let masked = css
  root.walkComments((comment) => {
    const start = comment.source?.start?.offset
    const end = comment.source?.end?.offset
    if (start === undefined || end === undefined) return
    masked = masked.slice(0, start) + masked.slice(start, end + 1).replace(/[^\n]/g, ' ') + masked.slice(end + 1)
  })
  return masked
}

function cssHits(file: SourceFile): LintHit[] {
  const hits: LintHit[] = []
  for (const block of file.css) {
    const css = block.root.source?.input.css
    if (css === undefined) continue
    const masked = withoutComments(css, block.root)
    const offsets = rawOffsets(masked, false)
    for (const m of masked.matchAll(CSS_ESCAPE)) {
      if (backslashesBefore(masked, m.index!) % 2 === 1) continue
      if (Number.parseInt(m[1]!, 16) === SIGN_CODE) offsets.push(m.index!)
    }
    for (const i of offsets.sort((a, b) => a - b)) hits.push({ offset: block.offset + i, message: MESSAGE })
  }
  return hits
}

export const RIAL_RULES: readonly LintRule[] = [
  {
    id: 'source/old-rial-sign',
    severity: 'warning',
    title: 'Old rial sign',
    why: 'U+FDFC is the rial sign, a ligature of the Persian word ریال, and it is not the Saudi riyal sign: Unicode 17 added that as U+20C1. It is also a right-to-left letter (bidi class AL), not a currency sign (ET), so it behaves differently next to numbers.',
    fix: 'Write the code SAR or ر.س. Use the Saudi riyal sign U+20C1 only where the font has it.',
    langs: ['css', 'scss', 'html', 'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'],
    check: (file) => [...jsHits(file), ...(file.html ? htmlHits(file.html, file.text) : []), ...cssHits(file)],
  },
]
