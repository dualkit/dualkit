'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CONVERT_COPY } from '@/lib/convert-copy'
import { DASHBOARD_PINS, SHOT, shotSrc, type ProofScreen } from '@/lib/convert-proof'
import { useSequence } from '@/lib/v3/inview'

type Device = 'desktop' | 'phone'
const W = CONVERT_COPY.wipe
const DEVICES: readonly Device[] = ['desktop', 'phone']
/** Where the divide rests: half English, half Arabic. */
const REST = 50
const KEY_STEP = 5
const clamp = (p: number) => Math.min(100, Math.max(0, p))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * The hero: one TailAdmin screen with English on the left of a divide and Arabic on the right. Drag anywhere on the
 * screen, or use the arrow keys on the handle. On first view the divide sweeps across once, so the Arabic and its
 * numbered pins reveal themselves, then rests in the middle. The divide position lives in a CSS variable, not state,
 * so a drag never re-renders the screen.
 */
export function Wipe({ screens }: { screens: readonly ProofScreen[] }) {
  const [active, setActive] = useState(0)
  const [device, setDevice] = useState<Device>('desktop')
  const stage = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const pos = useRef(REST)
  const anim = useRef(0)
  const touched = useRef(false)
  const { visible, reduced } = useSequence(stage)
  const screen = screens[active]!
  const size = SHOT[device]
  const pinned = screen.slug === 'dashboard' && device === 'desktop'

  const apply = useCallback((p: number) => {
    pos.current = p
    const el = stage.current
    if (!el) return
    el.style.setProperty('--p', String(p))
    el.querySelectorAll<HTMLElement>('.cv-pin').forEach((pin) => { pin.toggleAttribute('data-on', Number(pin.dataset.x) > p + 1) })
    handle.current?.setAttribute('aria-valuenow', String(Math.round(100 - p)))
    handle.current?.setAttribute('aria-valuetext', `${Math.round(100 - p)}% Arabic`)
  }, [])

  const glide = useCallback((path: readonly (readonly [number, number])[]) => {
    cancelAnimationFrame(anim.current)
    let leg = 0
    let from = pos.current
    let start = performance.now()
    const tick = (now: number) => {
      const [to, ms] = path[leg]!
      const t = Math.min(1, (now - start) / ms)
      apply(from + (to - from) * ease(t))
      if (t < 1) { anim.current = requestAnimationFrame(tick); return }
      leg += 1
      if (leg >= path.length) return
      from = to
      start = now
      anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
  }, [apply])

  const moveTo = useCallback((p: number, animate: boolean) => {
    if (animate && !reduced) glide([[clamp(p), 520]])
    else { cancelAnimationFrame(anim.current); apply(clamp(p)) }
  }, [apply, glide, reduced])

  // A phone visitor starts on the phone shots, which are legible at their width.
  useEffect(() => { if (matchMedia('(max-width: 820px)').matches) setDevice('phone') }, [])
  useLayoutEffect(() => { apply(pos.current) }, [apply, active, device])
  useLayoutEffect(() => { if (!reduced) apply(100) }, [apply, reduced])
  useEffect(() => {
    if (!visible || reduced || touched.current) return
    touched.current = true
    glide([[100, 280], [6, 1700], [6, 500], [REST, 900]])
  }, [visible, reduced, glide])
  useEffect(() => () => cancelAnimationFrame(anim.current), [])

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return ((e.clientX - r.left) / r.width) * 100
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    touched.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.dataset.drag = ''
    moveTo(fromPointer(e), false)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(fromPointer(e), false)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => { delete e.currentTarget.dataset.drag }
  const onKey = (e: KeyboardEvent) => {
    const to = { ArrowLeft: pos.current - KEY_STEP, ArrowRight: pos.current + KEY_STEP, Home: 0, End: 100 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    touched.current = true
    moveTo(to, false)
  }

  /** A legend pick: show the dashboard on a desktop and slide the divide just past the pin. */
  const reveal = (k: number) => {
    touched.current = true
    setActive(screens.findIndex((s) => s.slug === 'dashboard'))
    setDevice('desktop')
    const x = DASHBOARD_PINS[k]?.[0] ?? REST
    if (pos.current > x - 4) moveTo(Math.max(0, x - 10), true)
  }

  return (
    <div className="cv-wipe-wrap">
      <div className="cv-wipe-paint v3-painting" data-device={device}>
        <div className="cv-win v3-glass">
          <div className="cv-win-bar">
            <div className="cv-win-tabs" role="tablist" aria-label={W.screens}>
              {screens.map((s, i) => (
                <button key={s.slug} type="button" role="tab" aria-selected={i === active} className="cv-win-tab"
                  onClick={() => setActive(i)}>{s.name}</button>
              ))}
            </div>
            <div className="cv-win-side">
              <span className="cv-win-score">{W.score} <b>{screen.score}</b></span>
              <div className="cv-seg" role="radiogroup" aria-label={W.device}>
                {DEVICES.map((d, k) => (
                  <button key={d} type="button" role="radio" aria-checked={d === device} onClick={() => setDevice(d)}>{W.devices[k]}</button>
                ))}
              </div>
            </div>
          </div>
          <div ref={stage} className="cv-stage" style={{ aspectRatio: `${size.w} / ${size.h}` }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={`en-${screen.slug}-${device}`} className="cv-shot" src={shotSrc(screen.slug, 'en', device)} width={size.w} height={size.h}
              alt={`${screen.name} in English`} draggable={false} fetchPriority="high" />
            <div className="cv-stage-ar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={`ar-${screen.slug}-${device}`} className="cv-shot" src={shotSrc(screen.slug, 'ar', device)} width={size.w} height={size.h}
                alt={`${screen.name} in Arabic`} draggable={false} fetchPriority="high" />
              {pinned ? DASHBOARD_PINS.map(([x, y], k) => (
                <span key={k} className="cv-pin" data-x={x} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">{k + 1}</span>
              )) : null}
            </div>
            <span className="cv-stage-tag" data-side="en" aria-hidden="true">{W.en}</span>
            <span className="cv-stage-tag" data-side="ar" lang="ar" aria-hidden="true">{W.ar}</span>
            <div className="cv-divide">
              <button ref={handle} type="button" role="slider" className="cv-handle" aria-label={W.handle}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={REST} onKeyDown={onKey}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 4L2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ol className="cv-legend" data-pinned={pinned || undefined}>
        {W.pins.map(([title, body], k) => (
          <li key={title}>
            <button type="button" className="cv-legend-item" onClick={() => reveal(k)}>
              <span className="cv-legend-no" aria-hidden="true">{k + 1}</span>
              <span className="cv-legend-words"><span className="cv-legend-title">{title}</span><span className="v3-small cv-legend-body">{body}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
