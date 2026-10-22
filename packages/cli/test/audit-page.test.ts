import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { audit, shotScale } from '../src/audit'
import { UserError } from '../src/config'

const HERO_COLOUR = [0, 255, 0, 255]
const HERO = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{margin:0;font:16px/1.7 sans-serif}
.hero{min-height:100vh;background:rgb(0,255,0)}.x{margin:0;margin-left:16px;height:40px;background:rgb(255,0,255)}</style></head>
<body><section class="hero">مرحبا</section><p class="x">نص</p><div style="height:1500px"></div></body></html>`

const TALL_RTL = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>html,body{margin:0}.b{position:absolute;top:0;width:40px;height:40px}</style></head>
<body><div class="b" style="inset-inline-start:0;background:#f00"></div><div class="b" style="left:0;background:#00f"></div><div style="height:3000px"></div></body></html>`

// The eval injector's otp-digits bug on the first box; the second box is correct.
const OTP = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><p>رمز التحقق</p>
<input id="bad" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
<input id="good" autocomplete="one-time-code" inputmode="numeric"></body></html>`

/** Six one-digit boxes kept in framework-style state, not in .value, that send the code once all six are full. */
const OTP_STATE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><p>رمز التحقق</p>
${Array.from({ length: 6 }, (_, i) => `<input id="d${i}" autocomplete="one-time-code" inputmode="numeric" maxlength="1" oninput="digits[${i}]=this.value;if(digits.every(Boolean)){window.sent=true;fetch('/sent')}">`).join('')}
<script>const digits=['','','','','','']</script></body></html>`

/** A code field that reports each keystroke to the test through an exposed binding, so a test can see whether audit typed. */
const SPY = (lang: string, text: string) => `<!doctype html><html lang="${lang}" dir="rtl"><head><meta charset="utf-8"></head><body><p>${text}</p>
<input id="code" autocomplete="one-time-code" inputmode="numeric" oninput="window.dkTyped()"></body></html>`
const SPY_PAGES: Record<string, string> = { '/spy-ar': SPY('ar', 'رمز التحقق'), '/spy-he': SPY('he', 'הזן את הקוד') }

const VERY_TALL = '<!doctype html><html lang="ar" dir="rtl"><body style="margin:0"><div style="height:6000px"></div></body></html>'

const TAGS = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><p>مرحبا</p>
<table><tr><td>1</td></tr></table><form><input type="text"><input type="hidden"><textarea></textarea></form><div class="chat-window"></div></body></html>`

let server: Server
let base = ''
let sent = 0

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/sent') {
      sent += 1
      res.writeHead(204).end()
      return
    }
    if (req.url === '/otp-state') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(OTP_STATE)
      return
    }
    if (req.url === '/missing') {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<!doctype html><html><body><p>Not found</p></body></html>')
      return
    }
    if (req.url === '/broken') {
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' }).end('<!doctype html><html><body><p>Oops</p></body></html>')
      return
    }
    const page = SPY_PAGES[req.url ?? ''] ?? (req.url === '/otp' ? OTP : req.url === '/tags' ? TAGS : req.url === '/tall-rtl' ? TALL_RTL : req.url === '/very-tall' ? VERY_TALL : HERO)
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page)
  })
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://localhost:${(server.address() as { port: number }).port}`
})
afterAll(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) }))

const options = (url: string) => ({ url, width: 1024, height: 768, config: { ignore: [], exclude: [] } })

async function pixels(png: string, probes: Array<[number, number]>): Promise<{ width: number; height: number; colours: number[][] }> {
  const b = await chromium.launch()
  try {
    const p = await b.newPage()
    return await p.evaluate(async ({ data, probes }) => {
      const doc = (globalThis as any).document
      const img = doc.createElement('img')
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = `data:image/png;base64,${data}` })
      const c = doc.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      return { width: img.width, height: img.height, colours: probes.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data) as number[]) }
    }, { data: png, probes })
  } finally {
    await b.close()
  }
}

describe('audit on real page shapes', () => {
  it('puts markers on the right pixels below a min-height:100vh hero', async () => {
    const r = await audit(options(`${base}/`))
    const f = r.findings.find((x) => x.rule === 'layout/physical-spacing')
    expect(f?.node).toBeTruthy()
    const box = f!.node!.box
    const centre: [number, number] = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)]
    const shot = await pixels(r.screenshot, [[centre[0] * 2, centre[1] * 2]])
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(r.pageHeight)
    expect(shot.height).toBe(r.pageHeight * 2)
    expect(shot.colours[0]).not.toEqual(HERO_COLOUR)
    expect(shot.colours[0]).toEqual([255, 0, 255, 255])
  })

  it('keeps the inline end of a tall RTL page in the capture', async () => {
    const r = await audit(options(`${base}/tall-rtl`))
    const shot = await pixels(r.screenshot, [[2048 - 20, 20], [20, 20]])
    expect(shot.width).toBe(2048)
    expect(shot.height).toBe(6000)
    expect(shot.colours).toEqual([[255, 0, 0, 255], [0, 0, 255, 255]])
  })

  it('counts the tags the reviewer picks its rules from', async () => {
    const r = await audit(options(`${base}/tags`))
    expect(r.tags).toEqual({ table: 1, form: 1, input: 2, chat: 1 })
  })

  it('captures at 1x when 2x would make the screenshot too tall', async () => {
    const r = await audit(options(`${base}/very-tall`))
    const shot = await pixels(r.screenshot, [])
    expect(r.pageHeight).toBe(6000)
    expect(shot.width).toBe(1024)
    expect(shot.height).toBe(6000)
  })

  it('types Arabic digits into code fields and reports the one that deletes them', async () => {
    const r = await audit(options(`${base}/otp`))
    const found = r.findings.filter((f) => f.rule === 'content/drops-arabic-digits')
    expect(found.map((f) => [f.severity, f.node?.id])).toEqual([['error', 'input#bad']])
  })

  it('never fills every box of a one-digit code kept in framework state, so the code is never sent', async () => {
    sent = 0
    await audit(options(`${base}/otp-state`))
    expect(sent).toBe(0)
  })

  describe('only types into fields when the rule can fire', () => {
    /** Launches Chromium with a dkTyped binding on every context and counts its calls. */
    const spying = () => {
      const seen = { typed: 0 }
      const launch = async () => {
        const b = await chromium.launch()
        const newContext = b.newContext.bind(b)
        b.newContext = async (o) => {
          const c = await newContext(o)
          await c.exposeFunction('dkTyped', () => { seen.typed += 1 })
          return c
        }
        return b
      }
      return { seen, launch }
    }
    it('types into a code field on an Arabic page', async () => {
      const { seen, launch } = spying()
      await audit(options(`${base}/spy-ar`), launch)
      expect(seen.typed).toBeGreaterThan(0)
    })
    it('does not type when the config ignores content/drops-arabic-digits', async () => {
      const { seen, launch } = spying()
      await audit({ ...options(`${base}/spy-ar`), config: { ignore: ['content/drops-arabic-digits'], exclude: [] } }, launch)
      expect(seen.typed).toBe(0)
    })
    it('does not type on a Hebrew page that runs right to left', async () => {
      const { seen, launch } = spying()
      await audit(options(`${base}/spy-he`), launch)
      expect(seen.typed).toBe(0)
    })
  })

  it('picks a 2x capture for pages up to 4000px tall', () => {
    expect(shotScale(4000)).toBe(2)
    expect(shotScale(4001)).toBe(1)
  })

  it.each([['/missing', 404], ['/broken', 500]])('refuses to score an error page (%s)', async (path, status) => {
    const err = await audit(options(`${base}${path}`)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UserError)
    expect((err as Error).message).toBe(`${base}${path} returned ${status}.`)
  })
})
