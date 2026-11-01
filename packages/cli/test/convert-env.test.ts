import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { makeBrowserKit } from '../src/convert-env'

/** Paints from the clock, then grows after a slow request, the way a real dashboard does. */
const LIVE_PAGE = `<!doctype html><body style="margin:0"><div id="a" style="height:40px"></div><script>
document.getElementById('a').style.background = '#' + String(Date.now() % 1000).padStart(3, '0')
setTimeout(() => fetch('/slow').then((r) => r.text()).then(() => document.body.insertAdjacentHTML('beforeend', '<div style="height:2000px;background:#963"></div>')), 100)
</script>`

let server: Server
let base = ''
const seen: { cookie: string | undefined; lang: string | undefined }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push({ cookie: req.headers.cookie, lang: req.headers['accept-language'] as string | undefined })
    res.setHeader('content-type', 'text/html')
    if (req.url === '/slow') { setTimeout(() => res.end('ok'), 800); return }
    if (req.url === '/live') { res.end(LIVE_PAGE); return }
    res.end('<!doctype html><body style="margin:0"><div style="height:2000px;background:#369"></div>')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})
afterAll(() => { server.close() })

describe('makeBrowserKit', () => {
  it('takes a full-page English shot at the width, sends the cookies, and audits in the same browser', async () => {
    const kit = makeBrowserKit({}, { ignore: [], exclude: [] }, process.cwd(), new AbortController().signal)
    try {
      const png = PNG.sync.read(await kit.shoot(base, 390, { cookies: { 'dk-locale': 'ar' } }))
      expect(png.width).toBe(390)
      expect(png.height).toBe(2000)
      expect(seen.at(-1)?.cookie).toContain('dk-locale=ar')
      expect(seen.at(-1)?.lang).toMatch(/^en-US/)
      const result = await kit.audit(base, 390, { cookies: { 'dk-locale': 'ar' } })
      expect(result.errors).toBeGreaterThanOrEqual(0)
      expect(seen.at(-1)?.cookie).toContain('dk-locale=ar')
      await kit.shoot(base, 1280)
    } finally {
      await kit.close()
      await kit.close()
    }
  }, 60_000)

  it('shoots the same picture twice for a page that uses the clock and loads data late', async () => {
    const kit = makeBrowserKit({}, { ignore: [], exclude: [] }, process.cwd(), new AbortController().signal)
    try {
      const first = await kit.shoot(`${base}live`, 390)
      const second = await kit.shoot(`${base}live`, 390)
      expect(PNG.sync.read(first).height).toBe(2040)
      expect(first.equals(second)).toBe(true)
    } finally {
      await kit.close()
    }
  }, 60_000)

  it('refuses new work once the signal aborted', async () => {
    const controller = new AbortController()
    const kit = makeBrowserKit({}, { ignore: [], exclude: [] }, process.cwd(), controller.signal)
    controller.abort()
    await expect(kit.shoot(base, 390)).rejects.toThrow()
  })
})
