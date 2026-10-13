'use client'
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

// A perfect-circle take on bencho's eye tracker, rebuilt from its measured behaviour (viewBox 100):
// the eyes slide across the face towards the cursor, the face "turns" (the eyes narrow and move closer
// together near the edge), they tilt about 24° on diagonals, and they squint shut when the cursor is
// right over the face. A spring with ~10% overshoot settles in about 0.4s.
// When the cursor is far away the eyes drift back to the centre and glance around on their own.
// They blink every few seconds, sometimes twice.
const EYE = { w: 8.86, h: 14.85, gap: 19 }
const REACH = 30 // how far the eye pair travels from the centre, inside a circle of radius 47
const STIFFNESS = 0.18
const DAMPING = 0.72
const FAR_PX = 480 // past this distance the mascot stops tracking and idles
const BLINK_MS = 170
const keys = ['x', 'y', 'gap', 'w', 'h', 'rot'] as const
type K = (typeof keys)[number]
type Pose = Record<K, number>

const REST: Pose = { x: 50, y: 50, gap: EYE.gap, w: EYE.w, h: EYE.h, rot: 0 }
const between = (a: number, b: number) => a + Math.random() * (b - a)

export function Mascot() {
  const svg = useRef<SVGSVGElement>(null)
  const left = useRef<SVGGElement>(null), right = useRef<SVGGElement>(null)
  const eyesL = useRef<SVGRectElement>(null), eyesR = useRef<SVGRectElement>(null)

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const reduced = prefersReducedMotion()
    const now: Pose = { ...REST }
    const vel: Pose = { x: 0, y: 0, gap: 0, w: 0, h: 0, rot: 0 }
    const goal: Pose = { ...REST }
    let raf = 0
    let idle = true
    let blinkStart = -1
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (ms: number, fn: () => void) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }

    // 1 when open, dipping to 0.08 halfway through a blink.
    const openness = (t: number) => {
      if (blinkStart < 0) return 1
      const p = (t - blinkStart) / BLINK_MS
      if (p >= 1) { blinkStart = -1; return 1 }
      return 1 - 0.92 * Math.sin(p * Math.PI)
    }
    const paint = (t: number) => {
      const half = now.gap / 2, rad = (now.rot * Math.PI) / 180
      const ox = Math.cos(rad) * half, oy = Math.sin(rad) * half
      const h = now.h * openness(t)
      left.current?.setAttribute('transform', `translate(${(now.x - ox).toFixed(2)} ${(now.y - oy).toFixed(2)}) rotate(${now.rot.toFixed(2)})`)
      right.current?.setAttribute('transform', `translate(${(now.x + ox).toFixed(2)} ${(now.y + oy).toFixed(2)}) rotate(${now.rot.toFixed(2)})`)
      for (const r of [eyesL.current, eyesR.current]) {
        if (!r) continue
        r.setAttribute('width', now.w.toFixed(2)); r.setAttribute('height', h.toFixed(2))
        r.setAttribute('x', (-now.w / 2).toFixed(2)); r.setAttribute('y', (-h / 2).toFixed(2)); r.setAttribute('rx', (Math.min(now.w, h) / 2).toFixed(2))
      }
    }
    const tick = (t: number) => {
      let moving = blinkStart >= 0
      for (const k of keys) {
        vel[k] = (vel[k] + (goal[k] - now[k]) * STIFFNESS) * DAMPING
        now[k] += vel[k]
        if (Math.abs(vel[k]) + Math.abs(goal[k] - now[k]) > 0.01) moving = true
      }
      paint(t)
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    const kick = () => { if (reduced) { Object.assign(now, goal); paint(performance.now()); return } if (!raf) raf = requestAnimationFrame(tick) }

    const blink = () => {
      if (!reduced) { blinkStart = performance.now(); kick() }
      if (Math.random() < 0.25) later(BLINK_MS + 120, () => { if (!reduced) { blinkStart = performance.now(); kick() } })
      later(between(2600, 5200), blink)
    }
    // While idle, the eyes glance to a nearby spot every second or two, then back towards the middle.
    const wander = () => {
      if (idle) {
        const glance = Math.random() < 0.7
        Object.assign(goal, REST, glance ? { x: 50 + between(-9, 9), y: 50 + between(-6, 5) } : {})
        kick()
      }
      later(between(900, 2200), wander)
    }

    const look = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1
      if (d > FAR_PX) {
        if (!idle) { idle = true; Object.assign(goal, REST); kick() }
        return
      }
      idle = false
      if (d < r.width / 2) {
        Object.assign(goal, REST, { h: 1.9 }) // cursor on the face: a squint
      } else {
        const pull = Math.min(1, d / 320), nx = (dx / d) * pull, ny = (dy / d) * pull
        const turn = Math.min(1, Math.hypot(nx, ny))
        const tilt = Math.abs(nx) > 0.08 ? Math.atan(ny / nx) * (180 / Math.PI) * 0.53 : 0
        Object.assign(goal, { x: 50 + nx * REACH, y: 50 + ny * REACH, gap: EYE.gap * (1 - 0.47 * Math.abs(nx)), w: EYE.w * (1 - 0.24 * turn), h: EYE.h * (1 - 0.2 * turn), rot: tilt })
      }
      kick()
    }
    const away = () => { idle = true; Object.assign(goal, REST); kick() }

    paint(performance.now())
    addEventListener('pointermove', look, { passive: true })
    document.documentElement.addEventListener('pointerleave', away)
    later(1800, blink)
    later(1200, wander)
    return () => {
      removeEventListener('pointermove', look)
      document.documentElement.removeEventListener('pointerleave', away)
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout); timers.clear()
    }
  }, [])

  return (
    <div className="mascot" aria-hidden="true">
      <svg ref={svg} viewBox="0 0 100 100" width="56" height="56">
        <defs><clipPath id="mascot-face"><circle cx="50" cy="50" r="47" /></clipPath></defs>
        <circle cx="50" cy="50" r="47" fill="var(--ink)" />
        <g clipPath="url(#mascot-face)" fill="var(--page)">
          <g ref={left}><rect ref={eyesL} /></g>
          <g ref={right}><rect ref={eyesR} /></g>
        </g>
      </svg>
    </div>
  )
}
