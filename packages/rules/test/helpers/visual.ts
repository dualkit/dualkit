import type { Page } from 'playwright'

/** One character with where Chromium painted it, in logical (typed) order. */
export type CharBox = { ch: string; left: number; right: number; top: number }

/** Every character inside the first element matching the selector, measured with Range.getClientRects. */
export function charBoxes(p: Page, selector: string): Promise<CharBox[]> {
  return p.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`No element matches ${sel}`)
    const out: Array<{ ch: string; left: number; right: number; top: number }> = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const s = node.textContent ?? ''
      for (let i = 0; i < s.length; i++) {
        const range = document.createRange()
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        const r = range.getClientRects()[0]
        if (r) out.push({ ch: s[i]!, left: r.left, right: r.right, top: r.top })
      }
    }
    return out
  }, selector)
}

const painted = (boxes: CharBox[]) => boxes.filter((b) => b.ch.trim() !== '' && b.right > b.left)

/** The visible characters as a reader sees them on one line, left to right. */
export const visualText = (boxes: CharBox[]): string =>
  [...painted(boxes)].sort((a, b) => a.left - b.left).map((b) => b.ch).join('')

/** Which end of the line the last typed character (the closing mark) was painted at. */
export function markEdge(boxes: CharBox[]): 'left' | 'right' | 'inside' {
  const seen = painted(boxes)
  const mark = seen.at(-1)
  const rest = seen.slice(0, -1)
  if (!mark || rest.length === 0) return 'inside'
  if (mark.right <= Math.min(...rest.map((b) => b.left)) + 0.5) return 'left'
  if (mark.left >= Math.max(...rest.map((b) => b.right)) - 0.5) return 'right'
  return 'inside'
}
