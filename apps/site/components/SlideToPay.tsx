'use client'
import { useEffect, useRef, useState } from 'react'
import { EASE, prefersReducedMotion } from '@/lib/motion'
import { ArrowIcon, BackIcon, CheckIcon } from './icons'

// Drag the thumb to the far end to pay. In Arabic the track runs right to left, so the drag does too.
// The thumb is moved directly (not through React state) so it tracks the pointer 1:1 with no lag.
const COMMIT_AT = 0.75
const RESET_MS = 1600

type Props = { label: string; done?: string; rtl?: boolean; /** 'glass' is the square v3 look inside a glass panel; the default is the v2 pill. */ variant?: 'pill' | 'glass' }

export function SlideToPay({ label, done, rtl = false, variant = 'pill' }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLButtonElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ startX: number; grab: number; max: number; lastX: number; lastT: number; v: number } | null>(null)
  const progress = useRef(0)
  const [paid, setPaid] = useState(false)
  const sign = rtl ? -1 : 1
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  /** The track's inline padding, so the thumb stops flush with the far edge whatever the variant. */
  const inset = () => (track.current ? parseFloat(getComputedStyle(track.current).paddingLeft) || 0 : 0)
  const maxTravel = () => (track.current && thumb.current ? track.current.clientWidth - thumb.current.offsetWidth - inset() * 2 : 0)
  const paint = (p: number) => {
    progress.current = p
    const max = maxTravel()
    if (thumb.current) thumb.current.style.transform = `translateX(${sign * p * max}px)`
    if (fill.current) fill.current.style.width = `${p * max + (thumb.current?.offsetWidth ?? 0) / 2 + inset()}px`
    if (text.current) text.current.style.opacity = String(1 - p * 0.6)
  }
  const animateTo = (to: number, ms: number, easing: string, after?: () => void) => {
    const from = progress.current
    if (prefersReducedMotion() || from === to) { paint(to); after?.(); return }
    const t0 = performance.now()
    const ease = easing === 'spring' ? (t: number) => 1 - Math.cos(t * Math.PI * 1.25) * Math.exp(-6 * t) : (t: number) => 1 - (1 - t) ** 3
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      paint(from + (to - from) * ease(t))
      if (t < 1) requestAnimationFrame(step); else after?.()
    }
    requestAnimationFrame(step)
  }

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (paid) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const max = maxTravel()
    drag.current = { startX: e.clientX, grab: progress.current * max, max, lastX: e.clientX, lastT: performance.now(), v: 0 }
    if (thumb.current) thumb.current.style.transition = 'none'
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.max <= 0) return
    const now = performance.now()
    d.v = (e.clientX - d.lastX) / Math.max(now - d.lastT, 1); d.lastX = e.clientX; d.lastT = now
    paint(Math.min(1, Math.max(0, (d.grab + sign * (e.clientX - d.startX)) / d.max)))
  }
  const finish = () => {
    animateTo(1, 220, 'out', () => {
      setPaid(true)
      timer.current = setTimeout(() => { setPaid(false); animateTo(0, 500, 'out') }, RESET_MS)
    })
  }
  const onUp = () => {
    const d = drag.current; if (!d) return
    drag.current = null
    const flick = progress.current >= 0.5 && sign * d.v > 1.2 // a fast flick past halfway also pays
    if (progress.current >= COMMIT_AT || flick) finish()
    else {
      animateTo(0, 520, 'spring')
      thumb.current?.animate([{ scale: '1' }, { scale: '0.956 1.046' }, { scale: '1' }], { duration: 380, delay: 220, easing: EASE.expo })
    }
  }

  return (
    <div className={`slide${variant === 'glass' ? ' slide--glass' : ''}${paid ? ' done' : ''}`} ref={track} dir={rtl ? 'rtl' : 'ltr'} lang={rtl ? 'ar' : 'en'}>
      <span className="fill" ref={fill} />
      <span className="label" ref={text}>{paid && done ? done : label}</span>
      <button ref={thumb} type="button" className="thumb" aria-label={label}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!paid) finish() } }}>
        {paid ? <CheckIcon /> : rtl ? <BackIcon /> : <ArrowIcon />}
      </button>
    </div>
  )
}
