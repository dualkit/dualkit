// Browser verification of the v3 site against a running server (production: `npm run build && npx next start -p 3100`).
// Playwright is not a dependency of this repo: point PLAYWRIGHT_DIR at a folder where `playwright` is installed.
//
//   PLAYWRIGHT_DIR=/path/to/pw node scripts/verify-v3.mjs [--perf] [--only=pages,lazy,reduced,hero,menu,perf]
// Frame timing needs a real GPU: PW_HEADED=1 PW_CHANNEL=chrome (headless rAF is synthetic and reads a flat 16.7 ms).
//
// Env: BASE (default http://localhost:3100), OUT (screenshots and frames; default apps/site/.verify-out, gitignored).
// Checks: no horizontal scroll, no console errors, every [lang="ar"] is dir="rtl" (numeric LTR <bdi> runs excepted), full-page screenshots at 1440 and 390;
// under reduced motion the hero shows the fixed Arabic panel and the map canvas is fully drawn; a 30 fps screencast of
// one hero loop (panel never under the rail, single-frame pops flagged) and of the menu opening and closing (opacity
// and clip-path move one way only). --perf samples rAF intervals during the hero dolly, the map ripple and the menu.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE ?? 'http://localhost:3100'
const OUT = resolve(process.env.OUT ?? join(HERE, '..', '.verify-out'))
const PW_DIR = process.env.PLAYWRIGHT_DIR ?? process.cwd()
const ARGS = process.argv.slice(2)
const ONLY = (ARGS.find((a) => a.startsWith('--only='))?.slice(7).split(',')) ?? ['pages', 'lazy', 'reduced', 'hero', 'menu', ...(ARGS.includes('--perf') ? ['perf'] : [])]
const PAGES = ['/', '/docs', '/updates', '/status', '/bench']
const WIDTHS = [1440, 390]
const HERO_LOOP_MS = 24_500
const FRAME_BUDGET_MS = 20
const POP_MIN_DIFF = 2.5
const POP_RATIO = 3
/** The page height that goes with each tested width: a desktop window or an iPhone-sized phone. */
const heightFor = (width) => (width > 600 ? 900 : 844)

const { chromium } = createRequire(join(PW_DIR, 'package.json'))('playwright')
const failures = []
const fail = (msg) => { failures.push(msg); console.log(`  FAIL ${msg}`) }
const ok = (msg) => console.log(`  ok   ${msg}`)
const check = (cond, msg) => (cond ? ok(msg) : fail(msg))

function watchErrors(page) {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** Scrolls to the bottom in viewport steps so every in-view sequence and lazy image runs, then back to the top. */
async function walk(page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.8
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(400)
}

const scrollToSel = (page, sel, offset = 80) => page.evaluate(([s, o]) => {
  const el = document.querySelector(s)
  scrollTo(0, el.getBoundingClientRect().top + scrollY - o)
}, [sel, offset])

async function checkPages(browser) {
  console.log('pages')
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) } })
    for (const path of PAGES) {
      const page = await ctx.newPage()
      const errors = watchErrors(page)
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      await walk(page)
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        // Allowed: the hero's broken panel (lang="ar" dir="ltr" on purpose: an agent that knows no Arabic; the reduced run
        // checks its settled frame) and an LTR <bdi> that holds no Arabic letters (a phone number in Arabic-Indic digits).
        badAr: [...document.querySelectorAll('[lang="ar"]')].filter((el) => el.getAttribute('dir') !== 'rtl' && !el.matches('.v3-story [data-k="panel"]')
          && !(el.tagName === 'BDI' && el.getAttribute('dir') === 'ltr' && !/[\u0621-\u064A]/.test(el.textContent))).map((el) => el.outerHTML.slice(0, 80)),
      }))
      const tag = `${path} @${width}`
      check(m.sw === m.iw, `${tag} scrollWidth ${m.sw} = innerWidth ${m.iw}`)
      check(errors.length === 0, `${tag} console errors: ${errors.length ? errors.join(' | ') : 'none'}`)
      check(m.badAr.length === 0, `${tag} [lang=ar] without dir=rtl: ${m.badAr.length ? m.badAr.join(' | ') : 'none'}`)
      const name = path === '/' ? 'home' : path.slice(1)
      await page.screenshot({ path: join(OUT, `page-${name}-${width}.png`), fullPage: true })
      await page.close()
    }
    await ctx.close()
  }
}

/** The video, its poster and the footer painting are not fetched with the page, only as their sections near view. */
async function checkLazy(browser) {
  console.log('lazy media')
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) } })
    const page = await ctx.newPage()
    const got = []
    page.on('request', (r) => { const name = r.url().split('/').pop(); if (/^(region|footer)/.test(name)) got.push(name) })
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    check(got.length === 0, `@${width} nothing below the fold fetched on load (${got.join(', ') || 'none'})`)
    await scrollToSel(page, '.v3-rv', 0)
    await page.waitForTimeout(1500)
    check(got.includes('region-poster.webp') && got.some((n) => /^region\.(webm|mp4)$/.test(n)), `@${width} poster and video fetched near the video (${got.join(', ')})`)
    await ctx.close()
  }
}

/** Painted pixels on the map canvas (any alpha: the land squares are drawn faint). */
const inkPixels = (page) => page.evaluate(() => {
  const c = document.querySelector('.v3-region-canvas')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
  return n
})

async function checkReduced(browser) {
  console.log('reduced motion')
  for (const width of WIDTHS) {
    const height = heightFor(width)
    const still = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await still.newPage()
    const errors = watchErrors(page)
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const hero = await page.evaluate(() => {
      const story = document.querySelector('.v3-story')
      const panel = story.querySelector('[data-k="panel"]')
      return {
        fixed: panel.classList.contains('typeset') && panel.classList.contains('paid') && panel.getAttribute('dir') === 'rtl',
        shown: getComputedStyle(story.querySelector('[data-k="group"]')).opacity === '1',
        anims: story.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
        rail: story.querySelector('[data-k="rtitle"]').textContent.trim(),
      }
    })
    check(hero.fixed && hero.shown, `@${width} hero shows the fixed Arabic panel (rail: "${hero.rail}")`)
    check(hero.anims === 0, `@${width} hero runs no animations under reduced motion (${hero.anims})`)
    await page.screenshot({ path: join(OUT, `reduced-hero-${width}.png`) })
    await scrollToSel(page, '.v3-region-map', 40)
    await page.waitForTimeout(300)
    const reducedInk = await inkPixels(page)
    const pinsShown = await page.evaluate(() => [...document.querySelectorAll('.v3-region-pt')].every((p) => getComputedStyle(p).opacity === '1'))
    await page.screenshot({ path: join(OUT, `reduced-map-${width}.png`) })
    check(errors.length === 0, `@${width} reduced console errors: ${errors.length ? errors.join(' | ') : 'none'}`)

    // The same map with motion, once its ripple has finished, is the reference for "fully drawn".
    const moving = await browser.newContext({ viewport: { width, height } })
    const ref = await moving.newPage()
    await ref.goto(BASE + '/', { waitUntil: 'networkidle' })
    await scrollToSel(ref, '.v3-region-map', 40)
    await ref.waitForSelector('.v3-region-map[data-done]', { timeout: 15_000 })
    const doneInk = await inkPixels(ref)
    check(pinsShown && reducedInk > 0 && reducedInk >= doneInk * 0.99, `@${width} map fully drawn under reduced motion (${reducedInk} of ${doneInk} ink px), pins shown ${pinsShown}`)
    await moving.close()
    await still.close()
  }
}

/** CDP screencast at about 30 fps: the compositor sends every frame, every second one is kept. */
async function screencast(ctx, page, ms) {
  const cdp = await ctx.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ ts: f.metadata.timestamp * 1000, data: f.data })
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 2 })
  const stop = async () => { await cdp.send('Page.stopScreencast'); return frames }
  if (ms) { await page.waitForTimeout(ms); return stop() }
  return stop
}

/** Mean absolute pixel change between consecutive frames, computed in the browser; a lone spike is a pop or a cut. */
async function findPops(browser, frames) {
  const page = await browser.newPage()
  const diffs = await page.evaluate(async (list) => {
    const load = async (b64) => createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob())
    let prev = null
    const out = []
    for (const b64 of list) {
      const bmp = await load(b64)
      const c = new OffscreenCanvas(Math.round(bmp.width / 4), Math.round(bmp.height / 4))
      const g = c.getContext('2d')
      g.drawImage(bmp, 0, 0, c.width, c.height)
      const px = g.getImageData(0, 0, c.width, c.height).data
      if (prev) { let s = 0; for (let i = 0; i < px.length; i += 4) s += Math.abs(px[i] - prev[i]) + Math.abs(px[i + 1] - prev[i + 1]) + Math.abs(px[i + 2] - prev[i + 2]); out.push(s / (px.length / 4) / 3) }
      prev = px
    }
    return out
  }, frames.map((f) => f.data))
  await page.close()
  const pops = []
  for (let i = 1; i < diffs.length - 1; i++) {
    const d = diffs[i], around = Math.max(diffs[i - 1], diffs[i + 1])
    if (d > POP_MIN_DIFF && d > POP_RATIO * around) pops.push({ frame: i + 1, ms: Math.round(frames[i + 1].ts - frames[0].ts), diff: +d.toFixed(2) })
  }
  return { pops, maxDiff: Math.max(0, ...diffs) }
}

function saveFrames(dir, frames) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const t0 = frames[0]?.ts ?? 0
  frames.forEach((f) => writeFileSync(join(dir, `${String(Math.round(f.ts - t0)).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64')))
}

async function checkHero(browser) {
  console.log('hero loop')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = watchErrors(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.v3-story[data-live]')
  // Panel against the rail, ten times a second, on the page's own clock.
  await page.evaluate((ms) => {
    window.__overlaps = []
    const story = document.querySelector('.v3-story'), rail = story.querySelector('[data-k="rail"]')
    const t0 = performance.now()
    const id = setInterval(() => {
      const t = performance.now() - t0
      if (t > ms) return clearInterval(id)
      const p = story.querySelector('[data-k="group"] [data-k="panel"]')?.getBoundingClientRect(), r = rail.getBoundingClientRect()
      if (!p || +getComputedStyle(rail).opacity < 0.05) return
      const x = Math.min(p.right, r.right) - Math.max(p.left, r.left), y = Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top)
      if (x > 1 && y > 1) window.__overlaps.push({ ms: Math.round(t), area: Math.round(x * y) })
    }, 100)
  }, HERO_LOOP_MS)
  const frames = await screencast(ctx, page, HERO_LOOP_MS)
  saveFrames(join(OUT, 'hero-loop'), frames)
  const overlaps = await page.evaluate(() => window.__overlaps)
  const fps = frames.length / ((frames.at(-1).ts - frames[0].ts) / 1000)
  console.log(`  info ${frames.length} frames, ${fps.toFixed(1)} fps`)
  check(overlaps.length === 0, `panel never overlaps the rail${overlaps.length ? `: ${JSON.stringify(overlaps.slice(0, 8))}` : ''}`)
  const { pops, maxDiff } = await findPops(browser, frames)
  check(pops.length === 0, `hero loop has no single-frame pops (max frame diff ${maxDiff.toFixed(2)})${pops.length ? `: ${JSON.stringify(pops)}` : ''}`)
  check(errors.length === 0, `hero console errors: ${errors.length ? errors.join(' | ') : 'none'}`)
  await ctx.close()
}

async function checkMenu(browser) {
  console.log('menu')
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) } })
    const page = await ctx.newPage()
    await page.goto(BASE + '/docs', { waitUntil: 'networkidle' })
    const button = width > 600 ? '.v3-nav-link[aria-controls]' : '.v3-nav-burger'
    await page.evaluate(() => {
      window.__menu = []
      const m = document.querySelector('.v3-menu')
      const loop = () => {
        const cs = getComputedStyle(m)
        const bottom = /inset\(0(?:px)? 0(?:px)? ([\d.]+)%/.exec(cs.clipPath)?.[1]
        window.__menu.push({ t: performance.now(), o: +cs.opacity, clip: bottom === undefined ? 0 : +bottom })
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    })
    const stop = await screencast(ctx, page)
    const mark = () => page.evaluate(() => window.__menu.length)
    const a = await mark()
    await page.click(button)
    await page.waitForTimeout(500)
    const b = await mark()
    await page.click(button)
    await page.waitForTimeout(400)
    const c = await mark()
    const frames = await stop()
    saveFrames(join(OUT, `menu-${width}`), frames)
    const samples = await page.evaluate(() => window.__menu)
    const open = samples.slice(a, b), close = samples.slice(b, c)
    const oneWay = (s, key, dir) => s.every((v, i) => !i || dir * (v[key] - s[i - 1][key]) >= -0.001)
    const span = (s) => { const moving = s.filter((v, i) => i && (v.o !== s[i - 1].o || v.clip !== s[i - 1].clip)); return moving.length ? Math.round(moving.at(-1).t - s[0].t) : 0 }
    check(oneWay(open, 'o', 1) && oneWay(open, 'clip', -1) && open.at(-1).o === 1, `@${width} menu opens one way in ${span(open)} ms over ${open.filter((v) => v.o > 0 && v.o < 1).length} mid frames`)
    check(oneWay(close, 'o', -1) && oneWay(close, 'clip', 1) && close.at(-1).o === 0, `@${width} menu closes one way in ${span(close)} ms`)
    await ctx.close()
  }
}

/** rAF intervals while `run` drives the page; also long tasks. */
async function sampleFrames(page, run) {
  await page.evaluate(() => {
    window.__dt = []; window.__long = []
    let last = performance.now()
    const loop = (t) => { window.__dt.push(t - last); last = t; if (window.__sampling) requestAnimationFrame(loop) }
    window.__sampling = true
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop) })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false })
  })
  await run()
  const { dt, long } = await page.evaluate(() => { window.__sampling = false; return { dt: window.__dt, long: window.__long } })
  const s = [...dt].sort((x, y) => x - y)
  const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0
  return { frames: s.length, p50: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), max: +(s.at(-1) ?? 0).toFixed(1), over: s.filter((v) => v > FRAME_BUDGET_MS).length, longTasks: long }
}

async function checkPerf(browser) {
  console.log('performance (rAF intervals)')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.v3-story[data-live]')
  const results = {}
  // The first fix's camera dolly starts at 4.2 s; the checked chapter's at 14.45 s. Sample a whole loop.
  results.heroLoop = await sampleFrames(page, () => page.waitForTimeout(HERO_LOOP_MS))
  await scrollToSel(page, '.v3-region-map', 40)
  results.mapRipple = await sampleFrames(page, () => page.waitForSelector('.v3-region-map[data-done]', { timeout: 15_000 }))
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(300)
  results.menuOpen = await sampleFrames(page, async () => { await page.click('.v3-nav-link[aria-controls]'); await page.waitForTimeout(400); await page.click('.v3-nav-link[aria-controls]'); await page.waitForTimeout(300) })
  for (const [name, r] of Object.entries(results)) {
    check(r.over === 0 && r.longTasks.length === 0, `${name}: ${r.frames} frames, p50 ${r.p50} p95 ${r.p95} max ${r.max} ms, ${r.over} over ${FRAME_BUDGET_MS} ms, ${r.longTasks.length} long tasks`)
  }
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify(results, null, 2))
  await ctx.close()
  return results
}

if (ONLY.includes('perf') && !process.env.PW_HEADED && !process.env.PW_CHANNEL) {
  console.error('--perf needs a real renderer: set PW_HEADED=1 and PW_CHANNEL=chrome. Headless rAF is synthetic (a flat 16.7 ms) or software-rastered.')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, headless: !process.env.PW_HEADED })
try {
  if (ONLY.includes('pages')) await checkPages(browser)
  if (ONLY.includes('lazy')) await checkLazy(browser)
  if (ONLY.includes('reduced')) await checkReduced(browser)
  if (ONLY.includes('hero')) await checkHero(browser)
  if (ONLY.includes('menu')) await checkMenu(browser)
  if (ONLY.includes('perf')) await checkPerf(browser)
} finally {
  await browser.close()
}
console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed')
console.log(`screenshots: ${OUT}`)
process.exit(failures.length ? 1 : 0)
