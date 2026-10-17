import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright'
import { audit } from '../src/audit'
import { UserError } from '../src/config'

const page = readFileSync(new URL('./fixtures/page.html', import.meta.url), 'utf8')
let server: Server
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/hang') return // never answers, like a long poll
    if (req.url === '/csp') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'none'" }).end(page)
      return
    }
    if (req.url === '/slow-asset') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page.replace('</body>', '<img src="/hang"></body>'))
      return
    }
    const html = req.url === '/polling' ? page.replace('</body>', '<script>fetch("/hang")</script></body>') : page
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
  })
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://localhost:${(server.address() as { port: number }).port}`
})
afterAll(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) }))

const options = (url: string) => ({ url, width: 1024, height: 768, config: { ignore: [], exclude: [] } })

describe('audit', () => {
  it('finds the bugs on a real page, scores it and takes a screenshot', async () => {
    const r = await audit(options(`${base}/`))
    expect(r.findings.map((f) => f.rule)).toEqual(expect.arrayContaining(['bidi/unisolated-number', 'layout/physical-spacing']))
    expect(r.score).toBeLessThan(100)
    expect(r.screenshot.length).toBeGreaterThan(1000)
    expect(r.pageHeight).toBeGreaterThan(0)
  })

  it('applies ignore from the config', async () => {
    const r = await audit({ ...options(`${base}/`), config: { ignore: ['bidi/unisolated-number'], exclude: [] } })
    expect(r.findings.some((f) => f.rule === 'bidi/unisolated-number')).toBe(false)
  })

  it('finishes on a page that never goes network-idle', async () => {
    const r = await audit(options(`${base}/polling`))
    expect(r.findings.length).toBeGreaterThan(0)
  })

  it('explains how to install Chromium when it is missing', async () => {
    const launch = () => Promise.reject(new Error("browserType.launch: Executable doesn't exist at /x"))
    await expect(audit(options(`${base}/`), launch)).rejects.toThrow(/npx playwright@1\.55\.0 install chromium/)
  })

  it('says which page could not be opened', async () => {
    await expect(audit(options('http://localhost:1/'))).rejects.toThrow(/Could not open http:\/\/localhost:1\//)
  })

  it('reads a page whose CSP blocks scripts', async () => {
    const r = await audit(options(`${base}/csp`))
    expect(r.findings.length).toBeGreaterThan(0)
  })

  it('survives a subresource that never answers', async () => {
    const r = await audit(options(`${base}/slow-asset`))
    expect(r.findings.length).toBeGreaterThan(0)
  }, 30_000)

  it('turns a failure after load into a readable error', async () => {
    const page = {
      goto: async () => null,
      waitForLoadState: async () => undefined,
      waitForTimeout: async () => undefined,
      addScriptTag: async () => undefined,
      evaluate: async () => { throw new Error('Execution context was destroyed\n  at somewhere') },
    }
    const browser = { newContext: async () => ({ newPage: async () => page }), close: async () => undefined }
    const launch = async () => browser as unknown as Browser
    const err = await audit(options(`${base}/`), launch).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UserError)
    expect((err as Error).message).toBe(`Could not read ${base}/: Execution context was destroyed`)
  })

  it('only suggests installing Chromium when the executable is missing', async () => {
    const other = () => Promise.reject(new Error('browserType.launch: Target crashed\nmore'))
    await expect(audit(options(`${base}/`), other)).rejects.toThrow(/^Could not start Chromium: browserType\.launch: Target crashed$/)
    const missing = () => Promise.reject(new Error('Please run playwright install'))
    await expect(audit(options(`${base}/`), missing)).rejects.toThrow(/install chromium/)
  })
})
