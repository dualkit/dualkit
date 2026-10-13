'use client'
import { useEffect, useRef, useState } from 'react'

export const EASE = {
  expo: 'cubic-bezier(.16,1,.3,1)',
  odo: 'cubic-bezier(.22,1,.36,1)',
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True once the element has scrolled into view. It never flips back. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen] as const
}

/**
 * FLIP: measure keyed children, change the DOM, then spring each child from its old box to its new one.
 * Call `measure()` before the change and `play(before)` after React has committed it.
 */
export function measureKeyed(root: HTMLElement): Map<string, DOMRect> {
  return new Map([...root.querySelectorAll<HTMLElement>('[data-k]')].map((el) => [el.dataset.k ?? '', el.getBoundingClientRect()]))
}

export function playFlip(root: HTMLElement, before: Map<string, DOMRect>, { blur = true, stagger = 0 } = {}) {
  if (prefersReducedMotion()) return
  root.querySelectorAll<HTMLElement>('[data-k]').forEach((el, k) => {
    const a = before.get(el.dataset.k ?? ''); if (!a) return
    const b = el.getBoundingClientRect()
    const dx = (a.left + a.width / 2) - (b.left + b.width / 2), dy = a.top - b.top
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 640, delay: k * stagger, easing: EASE.expo, fill: 'backwards' })
    if (blur) el.animate([{ opacity: 0.2, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 360, delay: k * stagger, easing: EASE.odo, fill: 'backwards' })
  })
}

/** True while the element is on screen. Unlike useInView it flips back, so loops can pause off screen. */
export function useVisible<T extends Element>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, visible] as const
}
