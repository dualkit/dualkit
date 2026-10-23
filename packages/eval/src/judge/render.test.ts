import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { chromium, type Browser } from 'playwright'
import { PNG } from 'pngjs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { isBlank, shoot, SHOT_MAX_HEIGHT } from './render'

const png = (w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Buffer => {
  const img = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y)
      const i = (y * w + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  return PNG.sync.write(img)
}

describe('isBlank', () => {
  it('a flat image is blank', () => {
    expect(isBlank(png(40, 40, () => [250, 250, 250]))).toBe(true)
  })
  it('a page with text is not blank', () => {
    expect(isBlank(png(40, 40, (x, y) => (x < 20 && y < 20 ? [0, 0, 0] : [255, 255, 255])))).toBe(false)
  })
})

describe('shoot', () => {
  let browser: Browser
  const dir = mkdtempSync(join(tmpdir(), 'render-'))
  const write = (name: string, html: string) => {
    const p = join(dir, name)
    writeFileSync(p, html)
    return p
  }
  beforeAll(async () => {
    browser = await chromium.launch()
  })
  afterAll(async () => {
    await browser.close()
  })

  it('tall pages are capped', async () => {
    const file = write('tall.html', '<div style="height:6000px">x</div>')
    const out = PNG.sync.read(await shoot(file, browser, join(dir, 'cache1')))
    expect(out.height).toBe(SHOT_MAX_HEIGHT)
    expect(out.width).toBe(390)
  }, 30000)

  it('second shoot is served from cache', async () => {
    const file = write('short.html', '<p>hello</p>')
    const cache = join(dir, 'cache2')
    const first = await shoot(file, browser, cache)
    const spy = vi.spyOn(browser, 'newContext')
    const second = await shoot(file, browser, cache)
    expect(spy).not.toHaveBeenCalled()
    expect(second.equals(first)).toBe(true)
  }, 30000)
})
