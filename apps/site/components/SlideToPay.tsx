'use client'
import { useRef, useState } from 'react'
import { EASE, prefersReducedMotion } from '@/lib/motion'
import { ArrowIcon, BackIcon, CheckIcon } from './icons'

/** Drag the thumb to the far end to pay. In Arabic the track runs right to left, so the drag does too. */
export function SlideToPay({ label, done, rtl = false }: { label: string; done: string; rtl?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLButtonElement>(null)
  const start = useRef<{ x: number; max: number } | null>(null)
  const [p, setP] = useState(0)
  const [paid, setPaid] = useState(false)
  const sign = rtl ? -1 : 1

  const springBack = (from: number) => {
    setP(0)
    const el = thumb.current, max = start.current?.max ?? 0
    if (!el || prefersReducedMotion()) return
    el.animate([{ transform: `translateX(${sign * from * max}px)` }, { transform: 'translateX(0) scale(0.956, 1.046)', offset: 0.6 }, { transform: 'none' }], { duration: 380, easing: EASE.expo })
  }
  const finish = () => {
    setPaid(true); setP(1)
    setTimeout(() => { setPaid(false); setP(0) }, 1600)
  }
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (paid || !track.current || !thumb.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, max: track.current.clientWidth - thumb.current.offsetWidth - 8 }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current; if (!s) return
    setP(Math.min(1, Math.max(0, (sign * (e.clientX - s.x)) / s.max)))
  }
  const onUp = () => { if (!start.current) return; const at = p; if (at > 0.9) finish(); else springBack(at); start.current = null }
  const max = (track.current?.clientWidth ?? 0) - (thumb.current?.offsetWidth ?? 0) - 8

  return (
    <div className={`slide${paid ? ' done' : ''}`} ref={track} dir={rtl ? 'rtl' : 'ltr'} lang={rtl ? 'ar' : 'en'}>
      <span className="fill" style={{ width: `calc(${p * 100}% )` }} />
      <span className="label" style={{ opacity: paid ? 1 : 1 - p * 0.46 }}>{paid ? done : label}</span>
      <button ref={thumb} type="button" className="thumb" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish() } }}
        style={{ transform: `translateX(${sign * p * Math.max(max, 0)}px)` }}>
        {paid ? <CheckIcon /> : rtl ? <BackIcon /> : <ArrowIcon />}
      </button>
    </div>
  )
}
