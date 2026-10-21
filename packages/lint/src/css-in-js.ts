import type { Node, TemplateLiteral } from '@babel/types'
import scss from 'postcss-scss'
import { visit } from './ast'
import type { CssBlock, JsBlock } from './types'

/** Tags whose template holds CSS. `keyframes` is left out on purpose: its template holds steps, not rules. */
const CSS_TAGS = new Set(['css', 'createGlobalStyle', 'injectGlobal'])

/** `styled`, `styled.div`, `styled(Button)`, `styled('div')` and any `.attrs(...)` or `.withConfig(...)` chained on them. */
function isStyled(node: Node): boolean {
  if (node.type === 'Identifier') return node.name === 'styled'
  if (node.type === 'MemberExpression') return isStyled(node.object)
  if (node.type === 'CallExpression') return isStyled(node.callee)
  return false
}

const isCssTag = (tag: Node): boolean => (tag.type === 'Identifier' && CSS_TAGS.has(tag.name)) || isStyled(tag)

/** The same text with every character but a line break replaced by `fill`, so offsets and lines stay put. */
const blank = (text: string, fill: string): string => text.replace(/[^\r\n]/g, fill)

const DECLARATION_START = /(?:^|[{};]|\*\/)\s*$/
const DECLARATION_END = /^[ \t]*(?:;|\r?\n|$)/

/**
 * Stands in for a `${...}` of the same length. Where a whole declaration or rule could stand it becomes
 * a comment, so the CSS around it still parses; anywhere else it becomes an identifier of x.
 */
function placeholder(raw: string, before: string, after: string): string {
  if (raw.length >= 4 && DECLARATION_START.test(before) && DECLARATION_END.test(after)) {
    return `/*${blank(raw.slice(2, -2), ' ')}*/`
  }
  return blank(raw, 'x')
}

function cssOf(literal: TemplateLiteral, text: string, base: number): string | null {
  const quasis = literal.quasis
  const first = quasis[0]
  const last = quasis[quasis.length - 1]
  if (first?.start == null || last?.end == null) return null
  let out = ''
  for (const [i, quasi] of quasis.entries()) {
    if (quasi.start == null || quasi.end == null) return null
    out += text.slice(base + quasi.start, base + quasi.end)
    const next = quasis[i + 1]
    if (next?.start == null) continue
    const raw = text.slice(base + quasi.end, base + next.start)
    const after = text.slice(base + next.start, base + (next.end ?? next.start))
    out += placeholder(raw, out, after)
  }
  return out
}

/**
 * CSS inside styled-components, Emotion and Linaria tagged templates, one block per template. Each
 * `${...}` is swapped for text of the same length, so a block's offset is the template's first quasi
 * and every position maps straight back into the file. `text` is the file text the block's offsets
 * point into. A template that does not parse as SCSS gives no block.
 */
export function templateCss(block: JsBlock, text: string): CssBlock[] {
  const blocks: CssBlock[] = []
  visit(block.ast.program, (node) => {
    if (node.type !== 'TaggedTemplateExpression' || !isCssTag(node.tag)) return
    const first = node.quasi.quasis[0]
    if (first?.start == null) return
    const css = cssOf(node.quasi, text, block.offset)
    if (css === null) return
    try {
      blocks.push({ root: scss.parse(css), offset: block.offset + first.start })
    } catch {
      // Not CSS once the expressions are gone: leave this template unread.
    }
  })
  return blocks
}
