import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { audit } from '../src/audit'

const page = readFileSync(new URL('./fixtures/page.html', import.meta.url), 'utf8')
let server: Server
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/hang') return // never answers, like a long poll
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
})
