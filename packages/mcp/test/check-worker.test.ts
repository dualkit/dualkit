import { describe, expect, it } from 'vitest'
import { CHECK_TIMEOUT_MS } from '../src/tools/check-html'
import { expectPlainError, json, useClient } from './helpers'

const row = '<div class="card"><h3>عنوان المنتج</h3><p>اتصل على <span>050 123 4567</span> أو <a href="#">رابط</a> السعر ٥٠ د.إ</p></div>'
const bigPage = (rows: number) => `<!doctype html><html lang="ar" dir="rtl"><body>${row.repeat(rows)}</body></html>`
const small = '<!doctype html><html lang="ar" dir="rtl"><body><p>اتصل على <span>050 123 4567</span></p></body></html>'

describe('check_html in a worker', () => {
  const slow = useClient({ checkTimeoutMs: 200 })
  const normal = useClient()

  it('stops a check that runs past its time limit, with a plain sentence', async () => {
    const message = expectPlainError(await slow.call('check_html', { html: bigPage(2000) }))
    expect(message).toBe('The check took longer than 0.2 seconds, so it was stopped. Send a smaller page, or the part you changed.')
  })

  it('has a time limit of ten seconds by default', () => {
    expect(CHECK_TIMEOUT_MS).toBe(10_000)
  })

  it('keeps answering other calls while a page is checked', async () => {
    const order: string[] = []
    const check = normal.call('check_html', { html: bigPage(1500) }).then((r) => {
      order.push('check_html')
      return r
    })
    await normal.call('rules', {}).then(() => order.push('rules'))
    expect(json(await check)).toHaveProperty('findings')
    expect(order).toEqual(['rules', 'check_html'])
  })

  it('stops the check when the client cancels the call', async () => {
    const controller = new AbortController()
    const call = normal.client().callTool({ name: 'check_html', arguments: { html: bigPage(3000) } }, undefined, { signal: controller.signal })
    setTimeout(() => controller.abort(), 100)
    await expect(call).rejects.toThrow()
    // The server goes on answering after the cancelled check.
    expect(json(await normal.call('check_html', { html: small }))).toHaveProperty('findings')
  })

  it('leaves the main thread heap bounded across many checks', async () => {
    const before = process.memoryUsage().heapUsed
    // 100 checks, ten at a time: each one starts and ends its own worker.
    for (let batch = 0; batch < 10; batch++) {
      const results = await Promise.all(Array.from({ length: 10 }, () => normal.call('check_html', { html: small })))
      for (const r of results) json(r)
    }
    const grown = process.memoryUsage().heapUsed - before
    expect(grown).toBeLessThan(64 * 1024 * 1024)
  }, 120_000)
})
