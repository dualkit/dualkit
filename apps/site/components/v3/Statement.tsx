'use client'
import { useLayoutEffect, useRef } from 'react'
import { createClock } from '@/lib/v3/clock'
import { V3 } from '@/lib/v3/copy'
import { trackProgress, wordOpacity } from '@/lib/v3/reveal'
import './statement.css'

const LINES = V3.statement.lines.map(([text]) => String(text).split(' '))
const COUNT = LINES.flat().length
const NEAR_MARGIN = '200px 0px 200px 0px'

/** Full-viewport statement: sticky three-line text whose words read in with scroll, driven by one clock, written straight to the DOM. */
export function Statement() {
  const track = useRef<HTMLElement>(null)
  const stick = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = track.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const words = Array.from(root.querySelectorAll<HTMLElement>('[data-w]'))
    // The sticky block's height and its top (the nav's height) only change with the viewport, so they are measured on
    // resize, not on every tick. The run starts when the track's top reaches the sticky top, not the viewport top.
    let stickH = 0
    let stickTop = 0
    const read = () => {
      const el = stick.current
      stickH = el?.offsetHeight ?? 0
      stickTop = el ? parseFloat(getComputedStyle(el).top) || 0 : 0
    }
    read()
    const measure = () => { read(); write() }
    const write = () => {
      const t = root.getBoundingClientRect()
      const p = trackProgress(t.top - stickTop, t.height, stickH)
      words.forEach((w, i) => w.style.setProperty('--o', wordOpacity(p, i, COUNT).toFixed(3)))
    }
    write()
    const clock = createClock()
    const off = clock.onTick(write)
    let near = false
    let shown = !document.hidden
    const sync = () => (near && shown ? clock.play() : clock.pause())
    const io = new IntersectionObserver(([e]) => {
      near = !!e?.isIntersecting
      if (near) write()
      sync()
    }, { rootMargin: NEAR_MARGIN })
    io.observe(root)
    const onVis = () => {
      shown = !document.hidden
      sync()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      off()
      clock.pause()
    }
  }, [])

  return (
    <section ref={track} className="v3-st" aria-label="Statement">
      <div ref={stick} className="v3-st-stick">
        <div className="v3-wrap">
          <p className="v3-display v3-st-text">
            {LINES.map((words, l) => (
              <span key={l} className="v3-st-line">
                {words.map((w, k) => {
                  const n = LINES.slice(0, l).reduce((a, x) => a + x.length, 0) + k
                  return <span key={k}>{k ? ' ' : null}<span className="v3-st-w" data-w={n}>{w}</span></span>
                })}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  )
}
