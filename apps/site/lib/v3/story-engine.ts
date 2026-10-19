// The hero story's DOM choreography, ported from the approved prototype design/prototypes/hero3/index.html.
// One clock drives everything: story time advances on its ticks (and freezes on hover), scheduled beats run
// from its queue, and the pointer highlight follows on the same frames. Visuals are WAAPI animations that pause
// with the story. Only transform, opacity, clip-path, strokes, colours on small marks and blur on text spans move.
import { frameCamera, fitScale, type Rect } from './camera'
import { createClock } from './clock'
import { springAt } from './spring'
import { BEATS, CHECK_AT, FIX_AT, INSTALL_AT, LOOP_MS, MIRROR_SPRING, SWAP_GAP_MS } from './story'
import {
  AMOUNT_FX, AR_FACES, COMMAND, CURRENCY_FX, DATE, EN_FACES, PAY, PINS, RAIL, TITLE, W, face, keyFace, panelHTML, type KeyName, type RailState,
} from './story-markup'
import { V3 } from './copy'

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IO = 'cubic-bezier(0.77, 0, 0.175, 1)'
const EASE_EXPO = 'cubic-bezier(.16, 1, .3, 1)'
const EASE_ODO = 'cubic-bezier(.22, 1, .36, 1)'
const HOVER = '(hover: hover) and (pointer: fine)'
const MOBILE = '(max-width: 760px)'
const GREEN = '#3ecf6e'
/** Width change below which a resize is the phone toolbar, not a new layout. */
const RESIZE_GUARD_PX = 40
// Glass (backdrop-filter) is never faded: an element with a backdrop is shown and hidden with clip-path, and only the
// text on it fades. Opacity on the glass, or on any ancestor, makes Chromium and WebKit re-composite the backdrop, so the
// panel flashes dark or unblurred for a frame or two before it turns into glass.
const OPEN = 'inset(0px 0px 0px 0px)'
const SHUT_UP = 'inset(0px 0px 100% 0px)'
const SHUT_DOWN = 'inset(100% 0px 0px 0px)'
const KEYS: readonly KeyName[] = ['amount', 'date', 'phone', 'iban']

const SPRING_MS = MIRROR_SPRING.sampleMs
const spring = springAt(MIRROR_SPRING)
const SPRING_MID = (() => { for (let i = 0; i <= 400; i++) if (spring(i) >= 0.5) return i; return 0 })()

type Frame = Keyframe & Record<string, string | number | null | undefined>
type Cam = { s: number; tx: number; ty: number }
type Phase = 'build' | number | 'checked'
export type StoryHandle = { setVisible(v: boolean): void; destroy(): void }

/** Spring keyframes for a FLIP offset, with an optional arc in y. */
function springKF(dx: number, dy: number, arc: number, n = 44): Frame[] {
  const out: Frame[] = []
  for (let i = 0; i <= n; i++) {
    const p = i / n, k = i === n ? 1 : spring(p * SPRING_MS)
    const y = dy * (1 - k) + arc * Math.sin(Math.PI * Math.min(1, p * 1.7))
    out.push({ transform: `translate(${(dx * (1 - k)).toFixed(2)}px, ${(i === n ? 0 : y).toFixed(2)}px)`, offset: p })
  }
  return out
}

export function startStory(root: HTMLElement): StoryHandle {
  const q = <T extends Element = HTMLElement>(sel: string, r: ParentNode = root) => r.querySelector(sel) as T
  const qa = <T extends Element = HTMLElement>(sel: string, r: ParentNode = root) => [...r.querySelectorAll(sel)] as T[]
  const painting = q('[data-k="painting"]'), sky = q('[data-k="sky"]'), cam = q('[data-k="cam"]'), group = q('[data-k="group"]'), rail = q('[data-k="rail"]')
  const rno = q('[data-k="rno"]', rail)
  // Panel parts are looked up inside the live group, never inside a seek ghost.
  const g = <T extends Element = HTMLElement>(k: string) => q<T>(`[data-k="${k}"]`, group)
  const C = (k: string) => q(`[data-c="${k}"]`, group)
  const offs: Array<() => void> = []
  const on = (el: EventTarget, type: string, fn: EventListener) => { el.addEventListener(type, fn); offs.push(() => el.removeEventListener(type, fn)) }
  // The rail's glass is clipped, its text fades: the rail itself never animates opacity or transform.
  const railBg = q('.bg', rail)
  const railParts = () => qa(':scope > :not(.bg)', rail)
  const railHidden = () => { railBg.style.clipPath = SHUT_DOWN; railParts().forEach((el) => (el.style.opacity = '0')) }
  const railShown = () => { railBg.style.clipPath = ''; railParts().forEach((el) => { el.style.opacity = ''; el.style.transform = '' }) }

  // ---------- clock: story time t advances while playing; beats wait in a queue ----------
  const clock = createClock()
  let t = 0, lastPos = 0, playing = false, hoverPause = false, visible = false, started = false, dead = false
  type Job = { when: number; fn: () => void }
  let queue: Job[] = []
  const later = (ms: number, fn: () => void): Job => { const job = { when: t + ms, fn }; queue.push(job); queue.sort((a, b) => a.when - b.when); return job }
  let specTick: (() => void) | null = null
  offs.push(clock.onTick((pos) => {
    const dt = Math.min(64, pos - lastPos); lastPos = pos
    if (playing) { t += dt; while (queue.length && queue[0]!.when <= t) queue.shift()!.fn() }
    specTick?.()
  }))
  // The story's own WAAPI animations; CSS transitions (the highlight's fade) keep running while the story pauses.
  const anims = () => painting.getAnimations({ subtree: true }).concat(rail.getAnimations({ subtree: true })).filter((a) => !(a instanceof CSSTransition))
  function syncPlay() {
    const p = visible && !hoverPause
    if (visible) clock.play(); else clock.pause()
    if (p === playing) return
    playing = p
    anims().forEach((a) => { if (p && a.playState === 'paused') a.play(); else if (!p && a.playState === 'running') a.pause() })
  }

  // ---------- animation helpers ----------
  const owned = (el: Element, id: string) => el.getAnimations().filter((a) => a.id === id)
  function tween(el: Element, id: string, frames: Frame[], opts: KeyframeAnimationOptions) {
    owned(el, id).forEach((a) => a.cancel())
    const { offset: _o, easing: _e, composite: _c, ...last } = frames[frames.length - 1]!
    Object.assign((el as HTMLElement).style, last)
    const a = el.animate(frames, { fill: 'backwards', ...opts }); a.id = id
    if (!playing) a.pause()
    return a
  }
  const fadeIn = (el: Element, delay: number, dur = 300, blur = 6, dy = 6) =>
    tween(el, 'f', [{ opacity: 0, filter: `blur(${blur}px)`, transform: `translateY(${dy}px)` }, { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' }], { duration: dur, delay, easing: EASE_EXPO })
  const camScale = () => group.getBoundingClientRect().width / group.offsetWidth || 1
  function localRect(el: Element): Rect {
    const gr = group.getBoundingClientRect(), s = camScale(), r = el.getBoundingClientRect()
    return { x: (r.left - gr.left) / s, y: (r.top - gr.top) / s, w: r.width / s, h: r.height / s }
  }
  const words = (el: Element) => { const ws = qa('.w2', el); return ws.length ? ws : [el] }

  /** Old face blurs out word by word, a 60 ms gap, then the new face blurs in. Grid stacking keeps the cell anchored. */
  function swapFace(cell: Element, html: string, delay = 0, { out = 180, inn = 240, stagger = 40, gap = SWAP_GAP_MS, blur = 3, after }: { out?: number; inn?: number; stagger?: number; gap?: number; blur?: number; after?: (nf: HTMLElement, inAt: number) => void } = {}) {
    const old = ([...cell.children] as HTMLElement[]).filter((c) => c.classList.contains('face') && !c.dataset.leaving)
    const nf = document.createElement('span'); nf.className = 'face'; nf.innerHTML = html; cell.appendChild(nf)
    let outEnd = delay
    old.forEach((o) => {
      o.dataset.leaving = '1'
      const ws = words(o)
      ws.forEach((w, i) => tween(w, 'f', [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(3px)' }], { duration: out, delay: delay + i * stagger, easing: EASE_OUT }))
      outEnd = Math.max(outEnd, delay + out + (ws.length - 1) * stagger)
      later(outEnd + 10, () => { if (o.isConnected) o.remove() })
    })
    const inAt = old.length ? outEnd + gap : delay
    words(nf).forEach((w, i) => tween(w, 'f', blur
      ? [{ opacity: 0, filter: `blur(${blur}px)`, transform: 'translateY(3px)' }, { opacity: 1, filter: 'none', transform: 'none' }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: inn, delay: inAt + i * stagger, easing: EASE_OUT }))
    after?.(nf, inAt)
    return nf
  }
  /** Instant swap, for a cell that is invisible at that moment (mid-crossing in a mirror). */
  function hardSwap(cell: Element, html: string) {
    ;[...cell.children].filter((c) => c.classList.contains('face')).forEach((o) => o.remove())
    const nf = document.createElement('span'); nf.className = 'face'; nf.innerHTML = html; cell.appendChild(nf); snapOdos(nf)
  }

  // ---------- odometers ----------
  type Odo = HTMLElement & { _i?: number }
  const pct = (i: number) => `translateY(${-(i / 30) * 100}%)`
  function setOdo(el: Odo, d: number, delay = 0, dur = 520, dirn = 0) {
    const strip = el.firstElementChild as HTMLElement
    const cur = el._i ?? 10 + +el.dataset.d!
    let to = 10 + d
    if (dirn > 0 && to <= cur) to += 10
    if (dirn < 0 && to >= cur) to -= 10
    el._i = to; el.dataset.d = String(d)
    tween(strip, 'r', [{ transform: pct(cur) }, { transform: pct(to) }], { duration: dur, delay, easing: EASE_OUT })
    later(delay + dur + 20, () => { if (el._i === to) { el._i = 10 + d; owned(strip, 'r').forEach((a) => a.cancel()); strip.style.transform = pct(10 + d) } })
  }
  const rollIn = (scope: Element, delay: number, step = 30) => qa<Odo>('.od', scope).forEach((o, i) => { const d = +o.dataset.d!; o._i = (d + 3) % 10; setOdo(o, d, delay + i * step, 700, 1) })
  const snapOdos = (scope: Element) => qa<Odo>('.od', scope).forEach((o) => { o._i = 10 + +o.dataset.d!; (o.firstElementChild as HTMLElement).style.transform = pct(o._i) })
  function setNumber(container: Element, value: number, delay: number, dirn: number) {
    const ods = qa<Odo>('.od', container), s = String(value).padStart(ods.length, '0')
    ods.forEach((o, i) => { if (+o.dataset.d! !== +s[i]!) setOdo(o, +s[i]!, delay + i * 40, 520, dirn) })
  }

  // ---------- camera ----------
  const base = { s: 1, pin: 48, maxZoom: 1.3, inset: 32 as number | { x: number; y: number } }
  let camRest: Cam = { s: 1, tx: 0, ty: 0 }, regions: Rect[] = [], stripShown = false, camJob: Job | null = null
  /** What must stay in view: the panel, its pins either side, the room the type fix adds, the strip while it shows. */
  function bounds(): Rect {
    const panel = g('panel'), strip = g('strip')
    const grow = panel.classList.contains('typeset') ? 0 : 40
    const y1 = stripShown ? strip.offsetTop + strip.offsetHeight + grow : panel.offsetHeight + grow
    return { x: -base.pin, y: 0, w: panel.offsetWidth + 2 * base.pin, h: y1 }
  }
  /** Dolly towards a target but frame a box: the safe region that allows the most zoom, clamped so nothing leaves it. */
  function camFor(target: Element | null, zoom: number): Cam {
    const B = bounds()
    let best = regions[0]!, bestFit = -Infinity
    for (const R of regions) { const fit = fitScale(B, R, base.inset); if (fit > bestFit) { best = R; bestFit = fit } }
    const c = frameCamera(target ? localRect(target) : B, best, base.s * Math.min(zoom, base.maxZoom), { bounds: B, inset: base.inset })
    return { s: c.scale, tx: c.x, ty: c.y }
  }
  const camCSS = (c: Cam) => `translate(${c.tx.toFixed(2)}px, ${c.ty.toFixed(2)}px) scale(${c.s.toFixed(4)})`
  const skyCSS = (c: Cam) => `translate(${((c.tx - camRest.tx) * 0.15).toFixed(2)}px, ${((c.ty - camRest.ty) * 0.15).toFixed(2)}px) scale(${(1 + (c.s / base.s - 1) * 0.15).toFixed(4)})`
  function moveCam(c: Cam, dur = 800, delay = 0) {
    const from = getComputedStyle(cam).transform, fromSky = getComputedStyle(sky).transform
    cam.classList.add('moving')
    const job = later(delay + dur + 20, () => { if (camJob === job) cam.classList.remove('moving') }); camJob = job
    tween(cam, 'cam', [{ transform: from === 'none' ? camCSS(camRest) : from }, { transform: camCSS(c) }], { duration: dur, delay, easing: EASE_IO })
    tween(sky, 'cam', [{ transform: fromSky }, { transform: skyCSS(c) }], { duration: dur, delay, easing: EASE_IO })
  }
  function setCam(c: Cam) {
    owned(cam, 'cam').forEach((a) => a.cancel()); owned(sky, 'cam').forEach((a) => a.cancel())
    cam.style.transform = camCSS(c); sky.style.transform = skyCSS(c)
  }
  function layout() {
    const w = painting.clientWidth, h = painting.clientHeight, mobile = matchMedia(MOBILE).matches
    cam.style.width = `${w}px`; cam.style.height = `${h}px`
    base.pin = mobile ? 4 : 32; base.maxZoom = mobile ? 1.15 : 1.3; base.inset = mobile ? { x: 2, y: 16 } : 32
    regions = safeRegions(painting, rail, mobile)
    base.s = 1; base.s = Math.min(1, camFor(null, 1).s)
    camRest = camFor(null, 1)
  }
  const sizeRings = () => sizePanelRings(group)

  // ---------- rail ----------
  function railTo([no, title, line]: RailState, delay = 80, instant = false) {
    const rt = q('[data-k="rtitle"]', rail), rl = q('[data-k="rline"]', rail)
    if (instant) { rt.innerHTML = face(title); rl.innerHTML = face(line); qa<Odo>('.od', rno).forEach((o, i) => { o.dataset.d = no[i] }); snapOdos(rno); return }
    setNumber(rno, +no, delay, 1)
    swapFace(rt, W(title), delay, { stagger: 30 })
    swapFace(rl, W(line), delay + 60, { stagger: 12, out: 180, inn: 240 })
  }
  function tickFill(i: number, on: boolean, delay = 0) {
    const b = q(`[data-tick="${i}"] b`, rail)
    if (on) tween(b, 's', [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 260, delay, easing: EASE_EXPO })
    else { owned(b, 's').forEach((a) => a.cancel()); b.style.transform = 'scale(0)' }
  }

  // ---------- state ----------
  let fixed = 0, failing = 6, passing = 14
  let panelEvents = new AbortController()
  offs.push(() => panelEvents.abort())
  function render() {
    panelEvents.abort(); panelEvents = new AbortController()
    group.innerHTML = panelHTML(false)
    fixed = 0; failing = V3.story.check.startFailing; passing = V3.story.check.startPassing; stripShown = false; hoverPause = false
    snapOdos(group)
    g('bar').style.transform = `scaleX(${passing / 20})`
    sizeRings()
    // render() clears hoverPause (a rebuilt panel starts un-hovered), so the play state is re-derived here; otherwise a
    // resize or restart under the pointer would leave the story frozen until the next hover.
    syncPlay()
    // Hover pauses the story and lights the glass, only for a fine pointer that can hover.
    if (!matchMedia(HOVER).matches) return
    const panel = g('panel'), spec = g('spec'), signal = panelEvents.signal
    let tx = 260, ty = 0, x = 260, y = 0, over = false
    panel.addEventListener('pointerenter', () => { over = true; spec.style.opacity = '1'; hoverPause = true; syncPlay() }, { signal })
    panel.addEventListener('pointerleave', () => { over = false; spec.style.opacity = '0'; hoverPause = false; syncPlay() }, { signal })
    panel.addEventListener('pointermove', (ev) => { const r = panel.getBoundingClientRect(), s = r.width / panel.offsetWidth; tx = (ev.clientX - r.left) / s; ty = (ev.clientY - r.top) / s }, { signal })
    specTick = () => { if (!spec.isConnected || !over) return; x += (tx - x) * 0.18; y += (ty - y) * 0.18; spec.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }
  }
  function showStatic() {
    g('bg').style.clipPath = OPEN
    for (const el of qa('.row', group)) el.style.opacity = '1'
    const ring = g('ring'); ring.style.strokeDashoffset = '0'; ring.style.strokeOpacity = '.14'
  }

  // ---------- 1. build, broken ----------
  function build() {
    const b = BEATS.build, ring = g('ring'), rows = qa('.row', group)
    rows.forEach((r) => (r.style.opacity = '0')); qa('.pin', group).forEach((p) => (p.style.opacity = '0'))
    tween(ring, 'd', [{ strokeDashoffset: 1, strokeOpacity: 0.55 }, { strokeDashoffset: 0, strokeOpacity: 0.55, offset: 0.8 }, { strokeDashoffset: 0, strokeOpacity: 0.14 }], { duration: b.ringMs, easing: EASE_IO })
    tween(g('bg'), 'o', [{ clipPath: SHUT_UP }, { clipPath: OPEN }], { duration: b.bgMs, delay: b.bgDelay, easing: EASE_OUT })
    rows.forEach((r, i) => fadeIn(r, b.rowsAt + i * b.rowStagger))
    rollIn(C('amountV'), b.countAt)
    tween(g('bar'), 'b', [{ transform: 'scaleX(0)' }, { transform: `scaleX(${14 / 20})` }], { duration: 600, delay: b.countAt, easing: EASE_ODO })
    qa<Odo>('.od', g('failN')).forEach((o) => { o._i = 10; o.dataset.d = '0'; (o.firstElementChild as HTMLElement).style.transform = pct(10) })
    rollIn(g('score'), b.countAt)
    PINS.forEach((p, i) => {
      const pin = q(`[data-pin="${p.index}"]`, group), d = b.pinsAt + i * b.pinStagger
      tween(pin, 'f', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, delay: d, easing: EASE_EXPO })
      later(d, () => setNumber(g('failN'), i + 1, 0, 1))
    })
    railHidden(); railTo(RAIL.build, b.railAt)
    railParts().forEach((el) => tween(el, 'o', [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 420, delay: b.railFadeAt, easing: EASE_EXPO }))
    tween(railBg, 'o', [{ clipPath: SHUT_DOWN }, { clipPath: OPEN }], { duration: 420, delay: b.railFadeAt, easing: EASE_EXPO })
  }

  // ---------- 2. install ----------
  function install() {
    const b = BEATS.install, strip = g('strip'), typed = g('typed')
    stripShown = true
    moveCam(camFor(strip, 1.2), 800)
    railTo(RAIL.install, 80)
    tween(q('.bg', strip), 'f', [{ clipPath: SHUT_DOWN }, { clipPath: OPEN }], { duration: 420, delay: b.stripAt, easing: EASE_EXPO })
    tween(q('.icmd', strip), 'f', [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 420, delay: b.stripAt, easing: EASE_EXPO })
    ;[...COMMAND].forEach((_, i) => later(b.typeAt + i * b.typePerChar, () => { typed.textContent = COMMAND.slice(0, i + 1) }))
    tween(g('caret'), 'b', [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.51 }, { opacity: 0 }], { duration: 900, iterations: 3, delay: b.typeAt + COMMAND.length * b.typePerChar })
    later(b.loadedAt, () => {
      fadeIn(g('ld4'), 0, 300, 4, 0)
      qa('b', g('ld4')).forEach((sq, i) => tween(sq, 's', [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 240, delay: 120 + i * b.squareStagger, easing: EASE_EXPO }))
    })
  }
  function stripAway(delay = 0) {
    stripShown = false
    const strip = g('strip'), ld4 = g('ld4')
    tween(q('.bg', strip), 'f', [{ clipPath: OPEN }, { clipPath: SHUT_DOWN }], { duration: 300, delay, easing: EASE_OUT })
    tween(q('.icmd', strip), 'f', [{ opacity: 1, transform: 'translateY(0px)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 300, delay, easing: EASE_OUT })
    tween(ld4, 'f', [{ opacity: getComputedStyle(ld4).opacity }, { opacity: 0 }], { duration: 300, delay, easing: EASE_OUT })
  }
  /** The install strip at rest, off: its glass clipped away and its text transparent. */
  function stripHidden() {
    const strip = g('strip')
    q('.bg', strip).style.clipPath = SHUT_DOWN
    q('.icmd', strip).style.opacity = '0'
    g('ld4').style.opacity = '0'
  }

  // ---------- 3. the six fixes ----------
  // Mirror every row with springs. Things that cross in a row fade and blur while they share space and come back
  // once they have passed, so text never overlaps. Returns, per mover, the moment it is invisible.
  function flipDir(toRtl: boolean, delay = 0) {
    const panel = g('panel'), rows = qa('.row', group)
    const byRow = rows.map((row) => ([...row.children] as HTMLElement[]).filter((el) => !el.classList.contains('pin') && !el.classList.contains('btnface')))
    const before = byRow.map((els) => els.map((el) => el.getBoundingClientRect()))
    panel.dir = toRtl ? 'rtl' : 'ltr'
    const s = camScale(), after = byRow.map((els) => els.map((el) => el.getBoundingClientRect()))
    const Wd = panel.offsetWidth
    tween(g('sweep'), 's', [{ transform: `translateX(${toRtl ? Wd : -200}px)` }, { transform: `translateX(${toRtl ? -200 : Wd}px)` }], { duration: 440, delay, easing: EASE_IO })
    const roll = qa('span', g('roll'))
    roll.forEach((sp) => tween(sp, 'r', [{ transform: `translateY(${toRtl ? 0 : -100}%)` }, { transform: `translateY(${toRtl ? -100 : -200}%)` }], { duration: 380, delay: delay + 60, easing: EASE_OUT }))
    later(delay + 500, () => roll.forEach((sp) => { owned(sp, 'r').forEach((a) => a.cancel()); sp.style.transform = `translateY(${toRtl ? -100 : 0}%)` }))
    const swapAt = new Map<Element, number>(), D = 60 + SPRING_MS, N = 64
    byRow.forEach((els, ri) => {
      const rowStart = delay + 150 + ri * 45
      const m = els.map((el, i) => {
        const isKey = el.classList.contains('s') || el.dataset.k === 'grpA'
        return { el, x0: before[ri]![i]!.left / s, x1: after[ri]![i]!.left / s, w: after[ri]![i]!.width / s, off: isKey ? 0 : 60, arc: isKey ? -4 : 4 }
      })
      type M = (typeof m)[number]
      const xAt = (o: M, tt: number) => { const u = tt - o.off; if (u <= 0) return o.x0; if (u >= SPRING_MS) return o.x1; return o.x1 + (o.x0 - o.x1) * (1 - spring(u)) }
      m.forEach((o) => {
        if (Math.abs(o.x0 - o.x1) < 0.5) return
        const frames: Frame[] = []; let minOp = 1, minT = 0
        for (let i = 0; i <= N; i++) {
          const tt = (i / N) * D, x = xAt(o, tt), u = Math.max(0, Math.min(1, (tt - o.off) / SPRING_MS))
          let gap = Infinity
          for (const p of m) { if (p === o) continue; const px = xAt(p, tt); gap = Math.min(gap, Math.max(px - (x + o.w), x - (px + p.w))) }
          const op = i === N ? 1 : Math.max(0, Math.min(1, (gap - 6) / 30))
          if (op < minOp) { minOp = op; minT = tt }
          const y = o.arc * Math.sin(Math.PI * Math.min(1, u * 1.7))
          frames.push({ offset: i / N, transform: i === N ? 'none' : `translate(${(x - o.x1).toFixed(2)}px, ${y.toFixed(2)}px)`, opacity: +op.toFixed(3), filter: op > 0.99 ? 'none' : `blur(${((1 - op) * 3).toFixed(2)}px)` })
        }
        tween(o.el, 'x', frames, { duration: D, delay: rowStart, easing: 'linear' })
        if (minOp < 0.02) swapAt.set(o.el, rowStart + minT)
      })
    })
    tween(q('.rot', g('arw')), 't', [{ transform: `rotate(${toRtl ? 0 : 180}deg)` }, { transform: `rotate(${toRtl ? 180 : 0}deg)` }], { duration: 640, delay: delay + 150 + 6 * 45, easing: EASE_IO })
    return swapAt
  }

  const typeFaces = () => ({ title: TITLE.fx, amountK: keyFace.fx('amount'), dateK: keyFace.fx('date'), phoneK: keyFace.fx('phone'), ibanK: keyFace.fx('iban'), pay: PAY.fx })
  type Fix = { target: () => Element | null; run(d: number): void; instant(): void }
  const FIX: Fix[] = [
    { // direction
      target: () => null,
      run(d) { flipDir(true, d) },
      instant() { g('panel').dir = 'rtl'; qa('span', g('roll')).forEach((sp) => (sp.style.transform = 'translateY(-100%)')); q('.rot', g('arw')).style.transform = 'rotate(180deg)' },
    },
    { // bidi: the reversed digits lift away from the end back, then the number writes itself again from its start
      target: () => q('[data-row="phone"]', group),
      run(d) {
        const ph = g('ph'), chars = qa('.ch', ph), n = chars.length
        chars.forEach((c, i) => tween(c, 'f', [{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0, transform: 'translateY(-6px)', filter: 'blur(2px)' }], { duration: 200, delay: d + (n - 1 - i) * 18, easing: EASE_OUT }))
        later(d + (n - 1) * 18 + 200, () => {
          chars.slice().reverse().forEach((c) => ph.insertBefore(c, g('phring')))
          chars.forEach((c, i) => tween(c, 'f', [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 260, delay: 40 + (n - 1 - i) * 24, easing: EASE_OUT }))
        })
        tween(q('rect', g('phring')), 'd', [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, delay: d + 1080, easing: EASE_IO })
        tween(q('.chip', g('ph')), 'f', [{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'translateX(0px)' }], { duration: 300, delay: d + 1260, easing: EASE_EXPO })
      },
      instant() { const ph = g('ph'); qa('.ch', ph).reverse().forEach((c) => ph.insertBefore(c, g('phring'))); q<SVGRectElement>('rect', g('phring')).style.strokeDashoffset = '0'; q('.chip', ph).style.opacity = '1' },
    },
    { // type: an Arabic face, tracking cleared, rows grow to its line height
      target: () => q('[data-row="h"]', group),
      run(d) {
        const panel = g('panel'), rows = qa('.row', group), H0 = panel.offsetHeight, tops = rows.map((r) => r.offsetTop)
        panel.classList.add('typeset')
        const H1 = panel.offsetHeight
        Object.entries(typeFaces()).forEach(([k, html], i) => swapFace(C(k), html, d + i * 70, { stagger: 50 }))
        rows.forEach((r, i) => { const dy = tops[i]! - r.offsetTop; if (dy) tween(r, 'y', [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0px)' }], { duration: 640, delay: d + 120, easing: EASE_EXPO }) })
        for (const el of [g('bg'), g('ringbox'), g('sweepclip')]) tween(el, 'h', [{ transform: `scaleY(${H0 / H1})` }, { transform: 'scaleY(1)' }], { duration: 640, delay: d + 120, easing: EASE_EXPO })
        sizeRings()
      },
      instant() { g('panel').classList.add('typeset'); Object.entries(typeFaces()).forEach(([k, html]) => { C(k).innerHTML = face(html) }); sizeRings() },
    },
    { // hijri: digits rise in their own clipped slots
      target: () => q('[data-row="date"]', group),
      run(d) {
        swapFace(C('dateV'), DATE.fx, d, { stagger: 60, blur: 0, after: (nf, inAt) => { qa('.dg i', nf).forEach((gi, k) => tween(gi, 'y', [{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 420, delay: inAt + 40 + k * 45, easing: EASE_OUT })) } })
      },
      instant() { C('dateV').innerHTML = face(DATE.fx) },
    },
    { // money: the amount mirrors, the separator drops in, the trailing zero rolls, the symbol moves after
      target: () => q('[data-row="amount"]', group),
      run(d) {
        const amt = q('.amt', C('amountV')), num = q('.num', amt), cur = q('.cur', amt), chars = qa('.ch', num)
        const old = [...chars, cur], before = old.map((c) => c.getBoundingClientRect())
        amt.dir = 'rtl'; qa('.hide', num).forEach((h) => { h.classList.remove('hide'); h.style.opacity = '0' })
        const s = camScale(), after = old.map((c) => c.getBoundingClientRect())
        old.forEach((c, i) => {
          if (c.style.opacity === '0') return
          const dx = (before[i]!.left - after[i]!.left) / s
          if (Math.abs(dx) > 0.5) tween(c, 'x', springKF(dx, 0, c === cur ? -6 : 0), { duration: SPRING_MS, delay: d + (c === cur ? 0 : 60 + i * 15), easing: 'linear' })
        })
        tween(q('.sep', num), 'f', [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 420, delay: d + 380, easing: EASE_EXPO })
        const z = q('.z0', num), zo = q<Odo>('.od', z)
        tween(z, 'f', [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d + 480, easing: EASE_OUT })
        zo._i = 7; (zo.firstElementChild as HTMLElement).style.transform = pct(7); setOdo(zo, 0, d + 480, 700, 1)
        swapFace(cur, CURRENCY_FX, d + 150 + SPRING_MID - 140)
      },
      instant() { C('amountV').innerHTML = face(AMOUNT_FX) },
    },
    { // iban: groups of four spring apart, each group lights in turn, then the verdict
      target: () => q('[data-row="iban"]', group),
      run(d) {
        const ib = g('ib'), chars = qa('.ch', ib), before = chars.map((c) => c.getBoundingClientRect())
        ib.classList.add('grouped')
        const s = camScale(), after = chars.map((c) => c.getBoundingClientRect())
        chars.forEach((c, i) => { const dx = (before[i]!.left - after[i]!.left) / s; if (Math.abs(dx) > 0.5) tween(c, 'x', springKF(dx, 0, 0), { duration: SPRING_MS, delay: d + +c.dataset.g! * 35, easing: 'linear' }) })
        later(d + 560, () => {
          const groups = [...new Set(chars.map((c) => +c.dataset.g!))]
          groups.forEach((gr, gi) => {
            const gc = chars.filter((c) => +c.dataset.g! === gr), x0 = gc[0]!.offsetLeft, last = gc[gc.length - 1]!, x1 = last.offsetLeft + last.offsetWidth
            const hl = document.createElement('span'); hl.className = 'gl'; hl.style.left = `${x0 - 3}px`; hl.style.width = `${x1 - x0 + 6}px`; ib.appendChild(hl)
            tween(hl, 'f', [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 520, delay: gi * 80, easing: 'linear' })
            gc.forEach((c) => tween(c, 'c', [{ color: 'rgba(255,255,255,.64)' }, { color: '#fff' }], { duration: 200, delay: gi * 80 + 60, easing: EASE_OUT }))
            later(gi * 80 + 600, () => hl.remove())
          })
          tween(q('.chip', ib), 'f', [{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'translateX(0px)' }], { duration: 300, delay: groups.length * 80 + 60, easing: EASE_EXPO })
        })
      },
      instant() { const ib = g('ib'); ib.classList.add('grouped'); qa('.ch', ib).forEach((c) => (c.style.color = '#fff')); q('.chip', ib).style.opacity = '1' },
    },
  ]

  function resolvePin(i: number, d: number) {
    const pin = q(`[data-pin="${i}"]`, group)
    tween(q('.pn', pin), 'f', [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 160, delay: d, easing: EASE_OUT })
    tween(q('svg', pin), 'f', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 240, delay: d + 80, easing: EASE_EXPO })
    tween(q('.pq', pin), 'c', [{ backgroundColor: '#09090b' }, { backgroundColor: '#1f8f4a' }], { duration: 240, delay: d + 40, easing: EASE_OUT })
    tween(pin, 'f', [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 280, delay: d + 620, easing: EASE_OUT })
    failing -= 1; passing += 1
    const [one, many] = V3.story.check.failing
    later(d + 140, () => {
      setNumber(g('failN'), failing, 0, -1); setNumber(g('score'), passing, 0, 1)
      tween(g('bar'), 'b', [{ transform: `scaleX(${(passing - 1) / 20})` }, { transform: `scaleX(${passing / 20})` }], { duration: 520, easing: EASE_ODO })
      if (failing === 1) swapFace(g('failW'), one!, 0, { out: 160, inn: 200 })
      if (failing === 0) {
        swapFace(g('failW'), many!, 0, { out: 160, inn: 200 })
        tween(g('state'), 'c', [{ backgroundColor: 'rgba(0,0,0,0)', borderColor: '#fff' }, { backgroundColor: GREEN, borderColor: GREEN }], { duration: 300, easing: EASE_OUT })
      }
      tickFill(i, true, 100)
    })
  }
  function resolveInstant(i: number) { q(`[data-pin="${i}"]`, group).style.opacity = '0'; failing -= 1; passing += 1; tickFill(i, true) }
  function countersInstant() {
    qa('.od', g('failN')).forEach((o) => { o.dataset.d = String(failing) })
    const sc = String(passing).padStart(2, '0'); qa('.od', g('score')).forEach((o, i) => { o.dataset.d = sc[i] })
    snapOdos(g('content'))
    g('bar').style.transform = `scaleX(${passing / 20})`
    const [one, many] = V3.story.check.failing
    g('failW').innerHTML = face(failing === 1 ? one! : many!)
    if (failing === 0) { g('state').style.background = GREEN; g('state').style.borderColor = GREEN }
  }

  // ---------- 4. checked, then both directions ----------
  function mirrorTo(toEn: boolean, d: number) {
    qa('.chip', group).forEach((c) => tween(c, 'f', [{ opacity: 1 }, { opacity: 0, offset: 0.12 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 1200, delay: d, easing: 'linear' }))
    const swapAt = flipDir(!toEn, d)
    Object.entries(toEn ? EN_FACES : AR_FACES).forEach(([k, html]) => {
      const cell = C(k)
      const at = swapAt.get(cell)
      if (at !== undefined) later(at, () => hardSwap(cell, html))
      else swapFace(cell, html, d + 300, { stagger: 30, after: (nf) => snapOdos(nf) })
    })
    g('panel').lang = toEn ? 'en' : 'ar'
  }
  function checked() {
    const b = BEATS.checked
    moveCam(camFor(null, b.zoom), b.camMs)
    railTo(RAIL.checked, 80)
    tween(g('scan'), 's', [{ transform: 'translateY(-120px)' }, { transform: `translateY(${g('panel').offsetHeight + 30}px)` }], { duration: 900, delay: b.scanAt, easing: EASE_IO })
    tween(g('btnface'), 'c', [{ backgroundColor: 'rgba(255,255,255,.14)' }, { backgroundColor: '#ffffff' }], { duration: 320, delay: b.payAt, easing: EASE_OUT })
    later(b.payAt, () => { for (const el of [...qa('.pay', group), q('svg', g('arw'))]) tween(el, 'c', [{ color: '#fff' }, { color: '#09090b' }], { duration: 320, easing: EASE_OUT }); g('panel').classList.add('paid') })
    later(b.toEnglishAt, () => mirrorTo(true, 0))
    later(b.toArabicAt, () => mirrorTo(false, 0))
  }

  // ---------- the master timeline ----------
  function chapter(i: number) {
    const f = FIX[i]!, b = BEATS.fix
    if (i === 0) stripAway(0)
    moveCam(camFor(f.target(), b.zoom[i]!), b.camMs)
    railTo(RAIL.fix(i), 80)
    f.run(b.runAt)
    resolvePin(i, b.resolveAt[i]!)
    later(b.fixedAt, () => { fixed = i + 1 })
  }
  const fadeContent = () => tween(g('content'), 'o', [{ opacity: 0 }, { opacity: 1 }], { duration: BEATS.seekDissolveMs, easing: EASE_OUT })
  function startAt(phase: Phase) {
    queue = []; anims().forEach((a) => a.cancel())
    railShown()
    render(); stripHidden(); qa('[data-tick] b', rail).forEach((b) => (b.style.transform = 'scale(0)'))
    let t0 = 0
    if (phase === 'build') { setCam(camRest); build(); later(INSTALL_AT, install) }
    else {
      showStatic()
      const upto = phase === 'checked' ? 6 : phase
      for (let k = 0; k < upto; k++) { FIX[k]!.instant(); resolveInstant(k) }
      countersInstant()
      t0 = phase === 'checked' ? CHECK_AT : FIX_AT[phase]!
      railTo(phase === 'checked' ? RAIL.checked : phase ? RAIL.fix(phase - 1) : RAIL.install, 0, true)
      fadeContent()
    }
    FIX_AT.forEach((at, k) => { if (at >= t0) later(at - t0, () => chapter(k)) })
    if (CHECK_AT >= t0) later(CHECK_AT - t0, checked)
    const c = BEATS.close
    later(LOOP_MS - t0 - c.contentFadeBefore, () => tween(g('content'), 'o', [{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: EASE_OUT }))
    later(LOOP_MS - t0 - c.ringBefore, () => {
      tween(g('bg'), 'o', [{ clipPath: OPEN }, { clipPath: SHUT_UP }], { duration: 300, easing: EASE_OUT })
      tween(g('ring'), 'd', [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }], { duration: 300, easing: EASE_OUT })
    })
    later(LOOP_MS - t0 + c.camAfter, () => { moveCam(camRest, c.camMs); later(c.camMs, () => startAt('build')) })
  }

  /** Keep the camera where it is, rebuild the state underneath with a short dissolve, then play from the chapter. */
  function seek(i: number) {
    const keep = getComputedStyle(cam).transform, keepSky = getComputedStyle(sky).transform
    qa('.ghost', cam).forEach((gh) => gh.remove())
    group.getAnimations({ subtree: true }).forEach((a) => { try { a.commitStyles() } catch { /* a detached target has nothing to commit */ } })
    const ghost = group.cloneNode(true) as HTMLElement
    // The live panel's glass is already under the ghost; the ghost keeps only its text, so no backdrop ever fades.
    ghost.querySelectorAll('.bg').forEach((bg) => bg.remove())
    ghost.removeAttribute('data-k'); ghost.classList.add('ghost'); ghost.style.pointerEvents = 'none'; cam.appendChild(ghost)
    startAt(i)
    cam.style.transform = keep; sky.style.transform = keepSky
    const ga = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BEATS.seekDissolveMs, easing: EASE_OUT, fill: 'forwards' })
    ga.finished.then(() => ghost.remove(), () => ghost.remove())
  }
  on(q('[data-k="ticks"]', rail), 'click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-tick]')
    if (!b || !started) return
    seek(+b.dataset.tick!)
  })

  // ---------- boot ----------
  let lastW = window.innerWidth
  on(window, 'resize', () => {
    if (Math.abs(window.innerWidth - lastW) < RESIZE_GUARD_PX) return
    lastW = window.innerWidth; layout()
    if (started) startAt(Math.max(0, Math.min(5, fixed))); else setCam(camRest)
  })
  const ready = (document.fonts?.ready ?? Promise.resolve()).then(() => {
    if (dead) return
    render(); layout(); setCam(camRest)
    qa('.row', group).forEach((r) => (r.style.opacity = '0')); g('bg').style.clipPath = SHUT_UP
    railHidden()
    // The rail starts empty on "00", as in the prototype; the server's settled caption never shows under motion.
    q('[data-k="rtitle"]', rail).innerHTML = ''; q('[data-k="rline"]', rail).innerHTML = ''
    qa<Odo>('.od', rno).forEach((o) => { o.dataset.d = '0' }); snapOdos(rno)
    qa('[data-tick] b', rail).forEach((b) => (b.style.transform = 'scale(0)'))
    root.dataset.live = ''
  }).catch((err: unknown) => {
    console.error('[hero]', err)
    railShown()
    root.dataset.live = ''
  })

  return {
    setVisible(v) {
      void ready.then(() => {
        if (dead) return
        visible = v
        if (v && !started) { started = true; lastPos = clock.now(); startAt('build') }
        syncPlay()
      })
    },
    destroy() {
      dead = true
      clock.pause(); queue = []
      anims().forEach((a) => a.cancel())
      offs.forEach((off) => off()); specTick = null
      qa('.ghost', cam).forEach((gh) => gh.remove())
      delete root.dataset.live
    },
  }
}

/** Reduced motion: the fixed Arabic panel, framed by the resting camera, with no clock at all. */
export function settleStory(root: HTMLElement): () => void {
  const q = (sel: string) => root.querySelector(sel) as HTMLElement
  const painting = q('[data-k="painting"]'), cam = q('[data-k="cam"]'), group = q('[data-k="group"]'), rail = q('[data-k="rail"]'), sky = q('[data-k="sky"]')
  let dead = false
  const place = () => {
    if (dead) return
    painting.getAnimations({ subtree: true }).concat(rail.getAnimations({ subtree: true })).forEach((a) => a.cancel())
    all(root, '.ghost').forEach((gh) => gh.remove())
    group.innerHTML = panelHTML(true)
    q('[data-k="rtitle"]').innerHTML = face(RAIL.checked[1]); q('[data-k="rline"]').innerHTML = face(RAIL.checked[2])
    q('[data-k="rno"]').querySelectorAll<HTMLElement>('.od').forEach((o, i) => { o.dataset.d = RAIL.checked[0][i]; (o.firstElementChild as HTMLElement).style.transform = `translateY(${-((10 + +RAIL.checked[0][i]!) / 30) * 100}%)` })
    rail.querySelectorAll<HTMLElement>(':scope > *').forEach((el) => { el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = '' })
    sky.style.transform = ''
    all(rail, '[data-tick] b').forEach((b) => (b.style.transform = 'scale(1)'))
    sizePanelRings(group)
    const w = painting.clientWidth, h = painting.clientHeight, mobile = matchMedia(MOBILE).matches
    const panel = q('[data-k="panel"]'), pin = mobile ? 4 : 32, inset = mobile ? { x: 2, y: 16 } : 32
    const B: Rect = { x: -pin, y: 0, w: panel.offsetWidth + 2 * pin, h: panel.offsetHeight }
    const best = safeRegions(painting, rail, mobile).reduce((a, r) => (fitScale(B, r, inset) > fitScale(B, a, inset) ? r : a))
    const c = frameCamera(B, best, Math.min(1, fitScale(B, best, inset)), { bounds: B, inset })
    cam.style.width = `${w}px`; cam.style.height = `${h}px`
    cam.style.transform = `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) scale(${c.scale.toFixed(4)})`
  }
  void (document.fonts?.ready ?? Promise.resolve()).then(place).catch((err: unknown) => {
    console.error('[hero]', err)
    root.dataset.live = ''
  })
  // Phones fire resize when the toolbar shows or hides; only a real width change re-frames the panel.
  let lastW = window.innerWidth
  const onResize = () => {
    if (Math.abs(window.innerWidth - lastW) < RESIZE_GUARD_PX) return
    lastW = window.innerWidth; place()
  }
  window.addEventListener('resize', onResize)
  return () => { dead = true; window.removeEventListener('resize', onResize) }
}

const all = (r: ParentNode, sel: string) => [...r.querySelectorAll<HTMLElement>(sel)]

/** Where the panel may sit: beside the rail or above it on desktop (24 px from the rail once inset), the whole painting on a phone. */
function safeRegions(painting: HTMLElement, rail: HTMLElement, mobile: boolean): Rect[] {
  const w = painting.clientWidth, h = painting.clientHeight
  if (mobile) return [{ x: 0, y: 0, w, h }]
  const pr = painting.getBoundingClientRect(), rr = rail.getBoundingClientRect(), rx1 = rr.right - pr.left, ry0 = rr.top - pr.top
  return [{ x: rx1 - 8, y: 0, w: w - rx1 + 8, h }, { x: 0, y: 0, w, h: ry0 + 8 }]
}

/** The panel's traced ring and the phone's bidi ring are sized to what they wrap. */
function sizePanelRings(group: HTMLElement) {
  const q = (sel: string) => group.querySelector(sel) as HTMLElement
  const panel = q('[data-k="panel"]'), rb = q('[data-k="ringbox"]'), ring = q('[data-k="ring"]')
  rb.setAttribute('width', String(panel.offsetWidth)); rb.setAttribute('height', String(panel.offsetHeight))
  ring.setAttribute('width', String(panel.offsetWidth + 1)); ring.setAttribute('height', String(panel.offsetHeight + 1))
  const ph = q('[data-k="ph"]'), svg = q('[data-k="phring"]'), rect = svg.querySelector('rect')!
  const pw = all(ph, ':scope > .ch').reduce((a, c) => a + c.offsetWidth, 0) + 14, phh = ph.offsetHeight + 10
  svg.setAttribute('width', String(pw)); svg.setAttribute('height', String(phh)); rect.setAttribute('width', String(pw - 1)); rect.setAttribute('height', String(phh - 1))
}
