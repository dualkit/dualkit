import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium, type Browser, type Page } from 'playwright'
import type { ReadOptions } from '../../src/dom/reader'
import type { ScreenModel } from '../../src/model'

let browser: Promise<Browser> | null = null
let source: Promise<string> | null = null

export const readerSource = (): Promise<string> =>
  (source ??= build({
    entryPoints: [fileURLToPath(new URL('../../src/dom/entry.ts', import.meta.url))],
    bundle: true, format: 'iife', platform: 'browser', write: false,
  }).then((r) => r.outputFiles[0]!.text))

const page = async (): Promise<Page> => (await (browser ??= chromium.launch())).newPage({ viewport: { width: 1024, height: 768 } })

const read = async (p: Page, options: ReadOptions): Promise<ScreenModel> => {
  await p.addScriptTag({ content: await readerSource() })
  return p.evaluate((o) => (globalThis as unknown as { dualkitReader: { readScreen: (d: Document, o: ReadOptions) => ScreenModel } }).dualkitReader.readScreen(document, o), options)
}

/** Runs a measurement against rendered HTML in the shared browser. */
export async function withPage<T>(html: string, measure: (p: Page) => Promise<T>): Promise<T> {
  const p = await page()
  try {
    await p.setContent(html)
    return await measure(p)
  } finally {
    await p.close()
  }
}

export async function modelOf(html: string, options: ReadOptions = {}): Promise<ScreenModel> {
  const p = await page()
  try {
    await p.setContent(html)
    return await read(p, options)
  } finally {
    await p.close()
  }
}

/** Serves fake origins, so tests can load a cross-origin stylesheet without a network. */
export async function modelAt(url: string, routes: Record<string, { body: string; type: string }>, options: ReadOptions = {}): Promise<ScreenModel> {
  const p = await page()
  try {
    await p.route('**/*', (route) => {
      const hit = routes[route.request().url()]
      return hit ? route.fulfill({ body: hit.body, contentType: hit.type }) : route.abort()
    })
    await p.goto(url)
    return await read(p, options)
  } finally {
    await p.close()
  }
}

/**
 * Times the read inside the page and returns only counts, so a huge model is never copied out
 * (every run carries its block text, so a 5,000-run block would be a quarter of a gigabyte).
 */
export async function timeRead(html: string): Promise<{ ms: number; texts: number }> {
  const p = await page()
  try {
    await p.setContent(html)
    await p.addScriptTag({ content: await readerSource() })
    return await p.evaluate(() => {
      const start = performance.now()
      const m = (globalThis as unknown as { dualkitReader: { readScreen: (d: Document) => { texts: unknown[] } } }).dualkitReader.readScreen(document)
      return { ms: performance.now() - start, texts: m.texts.length }
    })
  } finally {
    await p.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) await (await browser).close()
  browser = null
}
