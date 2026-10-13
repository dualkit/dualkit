'use client'
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useVisible } from '@/lib/motion'

// A dot grid drawn from a real glyph. Dots near the cursor are pushed away and spring back;
// a click morphs ع into A and back. The loop sleeps once everything has settled.
const PITCH_WIDE = 18
const PITCH_NARROW = 12 // phones get a finer grid so the glyph reads as dots, not blobs
const PUSH_RADIUS = 90
const GLYPHS = [{ ch: 'ع', fontVar: '--font-plex-arabic', weight: 600 }, { ch: 'A', fontVar: '--font-switzer', weight: 500 }] as const

type Dot = { hx: number; hy: number; x: number; y: number; r: number; target: number }

function sampleGlyph(w: number, h: number, glyph: (typeof GLYPHS)[number]): (x: number, y: number) => number {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const family = getComputedStyle(document.documentElement).getPropertyValue(glyph.fontVar).trim() || 'sans-serif'
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `${glyph.weight} ${Math.round(h * 0.78)}px ${family}`
  ctx.fillText(glyph.ch, w / 2, h * (glyph.ch === 'A' ? 0.54 : 0.47))
  const data = ctx.getImageData(0, 0, w, h).data
  return (x, y) => data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3]! / 255
}

export function Halftone({ hint, hintTouch }: { hint: string; hintTouch: string }) {
  const [box, visible] = useVisible<HTMLDivElement>()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [which, setWhich] = useState(0)
  const state = useRef<{ dots: Dot[]; pointer: { x: number; y: number } | null; raf: number; w: number; h: number; dpr: number; pitch: number }>({ dots: [], pointer: null, raf: 0, w: 0, h: 0, dpr: 1, pitch: PITCH_WIDE })

  // Build the grid once per size and glyph.
  useEffect(() => {
    const el = box.current, cv = canvas.current
    if (!el || !cv) return
    let cancelled = false
    const build = async () => {
      await document.fonts?.ready
      if (cancelled) return
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2)
      const pitch = w < 480 ? PITCH_NARROW : PITCH_WIDE
      cv.width = w * dpr; cv.height = h * dpr
      const read = sampleGlyph(w, h, GLYPHS[which]!)
      const old = state.current.dots
      const dots: Dot[] = []
      let k = 0
      for (let y = pitch / 2; y < h; y += pitch) for (let x = pitch / 2; x < w; x += pitch) {
        const target = read(x, y)
        const prev = old[k++]
        dots.push({ hx: x, hy: y, x: prev?.x ?? x, y: prev?.y ?? y, r: prev?.r ?? target, target })
      }
      Object.assign(state.current, { dots, w, h, dpr, pitch })
      kick()
    }
    build()
    let lastWidth = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return // mobile browser bars change the height of the page, not this box
      lastWidth = el.clientWidth; state.current.dots = []; build()
    })
    ro.observe(el)
    return () => { cancelled = true; ro.disconnect() }
  }, [which])

  const draw = () => {
    const s = state.current, cv = canvas.current
    if (!cv) return false
    const ctx = cv.getContext('2d')!
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
    ctx.clearRect(0, 0, s.w, s.h)
    const reduced = prefersReducedMotion()
    let moving = false
    for (const d of s.dots) {
      let tx = d.hx, ty = d.hy
      if (s.pointer && !reduced) {
        const dx = d.hx - s.pointer.x, dy = d.hy - s.pointer.y, dist = Math.hypot(dx, dy)
        if (dist < PUSH_RADIUS && dist > 0.01) { const f = (1 - dist / PUSH_RADIUS) ** 2 * 26; tx += (dx / dist) * f; ty += (dy / dist) * f }
      }
      const k = reduced ? 1 : 0.14
      d.x += (tx - d.x) * k; d.y += (ty - d.y) * k; d.r += (d.target - d.r) * (reduced ? 1 : 0.09)
      if (Math.abs(tx - d.x) + Math.abs(ty - d.y) + Math.abs(d.target - d.r) > 0.02) moving = true
      const on = d.r > 0.5
      ctx.fillStyle = on ? '#09090b' : '#d4d4d8'
      ctx.beginPath(); ctx.arc(d.x, d.y, (s.pitch < PITCH_WIDE ? 1 : 1.4) + d.r * s.pitch * 0.42, 0, Math.PI * 2); ctx.fill()
    }
    return moving || s.pointer !== null
  }
  const kick = () => {
    const s = state.current
    if (s.raf) return
    const loop = () => { s.raf = 0; if (draw() && visible) s.raf = requestAnimationFrame(loop) }
    s.raf = requestAnimationFrame(loop)
  }
  useEffect(() => { if (visible) kick() }, [visible])

  return (
    <div className="halftone" ref={box} role="button" tabIndex={0} aria-label={`A dotted ${GLYPHS[which]!.ch}. Press to switch to ${GLYPHS[1 - which]!.ch}.`}
      onPointerMove={(e) => { if (e.pointerType === 'touch') return; const r = e.currentTarget.getBoundingClientRect(); state.current.pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; kick() }}
      onPointerLeave={() => { state.current.pointer = null; kick() }}
      onClick={() => setWhich((w) => 1 - w)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWhich((w) => 1 - w) } }}>
      <canvas ref={canvas} aria-hidden="true" />
      <span className="hint"><span className="hint-pointer">{hint}</span><span className="hint-touch">{hintTouch}</span></span>
    </div>
  )
}
