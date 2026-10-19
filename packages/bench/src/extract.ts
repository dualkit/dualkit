const THINK_TAG = /<(\/?)think>/gi
const OPENER = /^(`{3,})([\w-]*)[^\n]*$/gm
const CLOSER = /^(`+)[ \t]*$/gm
const HTML_END = '</html>'
const HTML_END_TAG = /<\/html>/gi
const DOCUMENT = /<!doctype html|<html[\s>]/i

type Block = { lang: string; body: string; bodyStart: number }

/** Drops reasoning: paired think blocks, an unclosed one to the end, and everything up to a lone closing tag. */
export function stripReasoning(text: string): string {
  let kept = ''
  let inside = false
  let cursor = 0
  for (const tag of text.matchAll(THINK_TAG)) {
    const at = tag.index ?? 0
    const closing = tag[1] === '/'
    if (!inside && !closing) {
      kept += text.slice(cursor, at)
      inside = true
    } else if (!inside) {
      kept = ''
    } else if (closing) {
      inside = false
    }
    cursor = at + tag[0].length
  }
  return inside ? kept : kept + text.slice(cursor)
}

/** A closing fence: a line of at least `ticks` backticks, optional trailing spaces. */
function findClose(text: string, from: number, ticks: number): { end: number; next: number } {
  const closer = new RegExp(CLOSER.source, 'gm')
  closer.lastIndex = from
  for (let m = closer.exec(text); m; m = closer.exec(text)) {
    if ((m[1] ?? '').length >= ticks) return { end: m.index, next: m.index + m[0].length }
  }
  return { end: text.length, next: text.length }
}

/** Every fenced block, found line by line so an inline triple backtick starts nothing. */
function scanBlocks(text: string): Block[] {
  const opener = new RegExp(OPENER.source, 'gm')
  const blocks: Block[] = []
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const bodyStart = Math.min(text.length, open.index + open[0].length + 1)
    const { end, next } = findClose(text, bodyStart, (open[1] ?? '').length)
    blocks.push({ lang: (open[2] ?? '').toLowerCase(), body: text.slice(bodyStart, end), bodyStart })
    opener.lastIndex = next
  }
  return blocks
}

/** A document body with no closing html tag runs on to the last one in the reply after its opener. */
function documentBody(text: string, block: Block): string {
  const body = block.body.trim()
  if (!DOCUMENT.test(block.body) || /<\/html>/i.test(block.body)) return body
  const closes = [...text.slice(block.bodyStart).matchAll(HTML_END_TAG)]
  const last = closes[closes.length - 1]
  if (last === undefined) return body
  return text.slice(block.bodyStart, block.bodyStart + (last.index ?? 0) + HTML_END.length).trim()
}

function longest(pages: string[]): string | null {
  return pages.reduce<string | null>((best, page) => (best === null || page.length > best.length ? page : best), null)
}

/** The page a model built, or null when the reply holds none. */
export function extractHtml(reply: string): string | null {
  const text = stripReasoning(reply)
  const blocks = scanBlocks(text)
  const tagged = blocks.filter((b) => b.lang === 'html' && b.body.trim().length > 0)
  const chosen = tagged.length > 0 ? tagged : blocks.filter((b) => DOCUMENT.test(b.body))
  const pages = chosen.map((b) => documentBody(text, b)).filter((p) => p.length > 0)
  const best = longest(pages)
  if (best !== null) return best
  const bare = text.trim()
  return /^(<!doctype html|<html[\s>])/i.test(bare) ? bare : null
}
