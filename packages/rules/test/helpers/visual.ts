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

/**
 * Where the ink sits inside an element, as fractions of its width: 0 is its left edge, 1 its right.
 * The element is screenshotted and its dark pixels counted, so it measures what is painted, such as an input's placeholder.
 */
export async function inkExtent(p: Page, selector: string): Promise<{ left: number; right: number }> {
  const png = (await p.locator(selector).first().screenshot()).toString('base64')
  return p.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const canvas = new OffscreenCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, img.width, img.height)
    let left = img.width
    let right = -1
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4]! < 128) {
          left = Math.min(left, x)
          right = Math.max(right, x)
        }
      }
    }
    if (right < 0) throw new Error('No ink found')
    return { left: left / img.width, right: (right + 1) / img.width }
  }, png)
}
