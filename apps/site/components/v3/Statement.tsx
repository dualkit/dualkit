'use client'
import { useLayoutEffect, useRef } from 'react'
import { V3 } from '@/lib/v3/copy'
import { useSequence } from '@/lib/v3/inview'
import { trackProgress, wordOpacity } from '@/lib/v3/reveal'
import './statement.css'

const LINES = V3.statement.lines.map(([text]) => String(text).split(' '))
const COUNT = LINES.flat().length
const NEAR_MARGIN = '200px 0px 200px 0px'

/** Full-viewport statement: sticky three-line text whose words read in with scroll, written straight to the DOM on scroll and resize only. */
export function Statement() {
  const track = useRef<HTMLElement>(null)
  const stick = useRef<HTMLDivElement>(null)
  // Live: if the OS setting turns on mid-session the scroll work stops (CSS already settles the words).
  const { reduced } = useSequence(track)

  useLayoutEffect(() => {
    const root = track.current
    if (!root || reduced) return
    const words = Array.from(root.querySelectorAll<HTMLElement>('[data-w]'))
    const last: string[] = words.map(() => '')
    // The sticky block's height and its top (the nav's height) only change with the viewport, so they are measured on
    // resize, not on every write. The run starts when the track's top reaches the sticky top, not the viewport top.
    let stickH = 0
    let stickTop = 0
    const read = () => {
      const el = stick.current
      stickH = el?.offsetHeight ?? 0
      stickTop = el ? parseFloat(getComputedStyle(el).top) || 0 : 0
    }
    // Writes only the words whose value changed, so a small scroll touches a few spans, not all of them.
    const write = () => {
      const t = root.getBoundingClientRect()
      const p = trackProgress(t.top - stickTop, t.height, stickH)
      words.forEach((w, i) => {
        const o = wordOpacity(p, i, COUNT).toFixed(3)
        if (o === last[i]) return
        last[i] = o
        w.style.setProperty('--o', o)
      })
    }
    read()
    write()
    // Scroll-linked work runs only when the scroll position or the viewport changes: one write per frame at most,
    // and none while the section is far from view.
    let frame = 0
    let near = false
    const schedule = () => {
      if (!near || frame) return
      frame = requestAnimationFrame(() => { frame = 0; write() })
    }
    const onResize = () => { read(); schedule() }
    const io = new IntersectionObserver(([e]) => {
      near = !!e?.isIntersecting
      schedule()
    }, { rootMargin: NEAR_MARGIN })
    io.observe(root)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [reduced])

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
