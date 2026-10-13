'use client'
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

// A perfect-circle take on bencho's eye tracker, rebuilt from its measured behaviour (viewBox 100):
// the eyes slide across the face towards the cursor and stay there, the face "turns" (the eyes narrow and
// move closer together near the edge), they tilt about 24° on diagonals, and they squint shut when the
// cursor is right over the face. A spring with ~10% overshoot settles in about 0.4s.
const EYE = { w: 8.86, h: 14.85, gap: 19 }
const REACH = 30 // how far the eye pair travels from the centre, inside a circle of radius 47
const STIFFNESS = 0.18
const DAMPING = 0.72
const keys = ['x', 'y', 'gap', 'w', 'h', 'rot'] as const
type K = (typeof keys)[number]

export function Mascot() {
  const svg = useRef<SVGSVGElement>(null)
  const left = useRef<SVGGElement>(null), right = useRef<SVGGElement>(null)
  const eyesL = useRef<SVGRectElement>(null), eyesR = useRef<SVGRectElement>(null)

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const reduced = prefersReducedMotion()
    const now: Record<K, number> = { x: 50, y: 50, gap: EYE.gap, w: EYE.w, h: EYE.h, rot: 0 }
    const vel: Record<K, number> = { x: 0, y: 0, gap: 0, w: 0, h: 0, rot: 0 }
    const goal: Record<K, number> = { ...now }
    let raf = 0

    const paint = () => {
      const half = now.gap / 2, rad = (now.rot * Math.PI) / 180
      const ox = Math.cos(rad) * half, oy = Math.sin(rad) * half
      left.current?.setAttribute('transform', `translate(${(now.x - ox).toFixed(2)} ${(now.y - oy).toFixed(2)}) rotate(${now.rot.toFixed(2)})`)
      right.current?.setAttribute('transform', `translate(${(now.x + ox).toFixed(2)} ${(now.y + oy).toFixed(2)}) rotate(${now.rot.toFixed(2)})`)
      for (const r of [eyesL.current, eyesR.current]) {
        if (!r) continue
        r.setAttribute('width', now.w.toFixed(2)); r.setAttribute('height', now.h.toFixed(2))
        r.setAttribute('x', (-now.w / 2).toFixed(2)); r.setAttribute('y', (-now.h / 2).toFixed(2)); r.setAttribute('rx', (Math.min(now.w, now.h) / 2).toFixed(2))
      }
    }
    const tick = () => {
      let moving = false
      for (const k of keys) {
        vel[k] = (vel[k] + (goal[k] - now[k]) * STIFFNESS) * DAMPING
        now[k] += vel[k]
        if (Math.abs(vel[k]) + Math.abs(goal[k] - now[k]) > 0.01) moving = true
      }
      paint()
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    const look = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1
      if (d < r.width / 2) {
        Object.assign(goal, { x: 50, y: 50, gap: EYE.gap, w: EYE.w, h: 1.9, rot: 0 }) // cursor on the face: a squint
      } else {
        const pull = Math.min(1, d / 320), nx = (dx / d) * pull, ny = (dy / d) * pull
        const turn = Math.min(1, Math.hypot(nx, ny))
        const tilt = Math.abs(nx) > 0.08 ? Math.atan(ny / nx) * (180 / Math.PI) * 0.53 : 0
        Object.assign(goal, { x: 50 + nx * REACH, y: 50 + ny * REACH, gap: EYE.gap * (1 - 0.47 * Math.abs(nx)), w: EYE.w * (1 - 0.24 * turn), h: EYE.h * (1 - 0.2 * turn), rot: tilt })
      }
      if (reduced) { Object.assign(now, goal); paint(); return }
      if (!raf) raf = requestAnimationFrame(tick)
    }
    paint()
    addEventListener('pointermove', look, { passive: true })
    return () => { removeEventListener('pointermove', look); cancelAnimationFrame(raf) }
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
