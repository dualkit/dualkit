import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser } from 'playwright'
import { PNG } from 'pngjs'
import { writeFileAtomic } from './atomic.js'
import { RUN } from '@dualkit/bench/src/config'

export const SHOT_WIDTH = 390
export const SHOT_MAX_HEIGHT = 2532
const SETTLE_MS = 300
const BLANK_SHARE = 0.99
const BLANK_TOLERANCE = 6

/** Full page PNG of a bench page at phone width, cached by the html's hash. */
export async function shoot(htmlPath: string, browser: Browser, cacheDir: string): Promise<Buffer> {
  const html = readFileSync(htmlPath, 'utf8')
  const cached = join(cacheDir, `${createHash('sha256').update(html).digest('hex')}.png`)
  if (existsSync(cached)) return readFileSync(cached)
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
  try {
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.waitForTimeout(SETTLE_MS)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    const png = await page.screenshot({
      fullPage: true,
      type: 'png',
      clip: { x: 0, y: 0, width: RUN.width, height: Math.min(height, SHOT_MAX_HEIGHT) },
    })
    mkdirSync(cacheDir, { recursive: true })
    writeFileAtomic(cached, png)
    return png
  } finally {
    await context.close()
  }
}

/** True when nearly every pixel is the most common colour, give or take a few levels. */
export function isBlank(png: Buffer): boolean {
  const { data, width, height } = PNG.sync.read(png)
  const total = width * height
  if (total === 0) return true
  const counts = new Map<number, number>()
  let top = 0
  let topKey = 0
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0)
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    if (n > top) {
      top = n
      topKey = key
    }
  }
  const [r, g, b] = [topKey >> 16, (topKey >> 8) & 255, topKey & 255]
  let near = 0
  for (const [key, n] of counts) {
    if (Math.abs((key >> 16) - r) <= BLANK_TOLERANCE && Math.abs(((key >> 8) & 255) - g) <= BLANK_TOLERANCE && Math.abs((key & 255) - b) <= BLANK_TOLERANCE) near += n
  }
  return near / total >= BLANK_SHARE
}
