'use client'
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

// A round mascot whose eyes slide across its face towards the cursor, after bencho's eye tracker
// (follow 60, bounce 30), made a perfect circle. It blinks every few seconds.
const SIZE = 96
const REACH = 0.6 * (SIZE * 0.24) // follow 60: how far the eyes travel across the face
const STIFFNESS = 0.14
const DAMPING = 0.7 // bounce 30: a little overshoot before settling

export function Mascot() {
  const eyes = useRef<HTMLDivElement>(null)
  const face = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = eyes.current, body = face.current
    if (!el || !body) return
    const reduced = prefersReducedMotion()
    const pos = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
    let raf = 0
    const tick = () => {
      pos.vx = (pos.vx + (pos.tx - pos.x) * STIFFNESS) * DAMPING
      pos.vy = (pos.vy + (pos.ty - pos.y) * STIFFNESS) * DAMPING
      pos.x += pos.vx; pos.y += pos.vy
      el.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      raf = Math.abs(pos.vx) + Math.abs(pos.vy) + Math.abs(pos.tx - pos.x) > 0.05 ? requestAnimationFrame(tick) : 0
    }
    const look = (e: PointerEvent) => {
      const r = body.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1, pull = Math.min(1, d / 260)
      pos.tx = (dx / d) * REACH * pull; pos.ty = (dy / d) * REACH * pull
      if (reduced) { pos.x = pos.tx; pos.y = pos.ty; el.style.transform = `translate(${pos.x}px, ${pos.y}px)`; return }
      if (!raf) raf = requestAnimationFrame(tick)
    }
    addEventListener('pointermove', look, { passive: true })
    let blinkTimer: ReturnType<typeof setTimeout>
    const blink = () => {
      if (!reduced) el.animate([{ scale: '1 1' }, { scale: '1 0.1' }, { scale: '1 1' }], { duration: 160, easing: 'ease-in-out', composite: 'add' })
      blinkTimer = setTimeout(blink, 3000 + Math.random() * 3000)
    }
    blinkTimer = setTimeout(blink, 2500)
    return () => { removeEventListener('pointermove', look); cancelAnimationFrame(raf); clearTimeout(blinkTimer) }
  }, [])
  return (
    <div className="mascot" ref={face} aria-hidden="true">
      <div className="eyes" ref={eyes}><i /><i /></div>
    </div>
  )
}
