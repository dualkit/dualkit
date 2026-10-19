'use client'
import { useLayoutEffect, useRef } from 'react'
import { GLASS_POOL, paneStates, type Box } from '@/lib/v3/glass-stage'

/** How long a spare pane stays visible while it folds away before it is hidden (matches the clip transition). */
const FOLD_MS = 260
const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })

/**
 * The persistent glass behind crossfading previews. Mount it as the first child of the stage (a positioned painting);
 * the stage's previews sit in children marked data-on when active. The panes blur once and stay at opacity 1; on a
 * switch only their clip-path moves to the active preview's glass boxes, so the backdrop never re-composites.
 */
export function GlassLayer({ active }: { active: number }) {
  const layer = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const shown = useRef<Box[]>([])

  useLayoutEffect(() => {
    const el = layer.current
    const stage = el?.parentElement
    if (!el || !stage) return
    const panes = Array.from(el.children) as HTMLElement[]
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const place = (animate: boolean) => {
      const s = stage.getBoundingClientRect()
      if (!s.width || !s.height) return
      const boxes = Array.from(stage.querySelectorAll<HTMLElement>('[data-on] .v3-glass')).map((g) => box(g.getBoundingClientRect()))
      el.dataset.animate = animate ? '1' : '0'
      paneStates(boxes, box(s), shown.current).forEach((p, i) => {
        const pane = panes[i]
        if (!pane) return
        if (animate && p.from) {
          // Start a returning pane at its box's centre, without a transition, then let it grow.
          pane.style.transition = 'none'
          pane.style.clipPath = p.from
          void pane.offsetWidth
          pane.style.transition = ''
        }
        pane.style.clipPath = p.clip
        if (p.used) pane.style.visibility = 'visible'
        else if (!animate) pane.style.visibility = 'hidden'
        else timers.push(setTimeout(() => { if (pane.dataset.used !== '1') pane.style.visibility = 'hidden' }, FOLD_MS))
        pane.dataset.used = p.used ? '1' : '0'
      })
      shown.current = boxes
      stage.dataset.glass = 'stage'
    }
    let live = true
    if (first.current) {
      place(false)
      // Webfonts change the previews' heights once they load.
      void document.fonts?.ready.then(() => { if (live) place(false) })
    } else place(true)
    first.current = false
    // A new width can rescale the previews (the menu fits them to its column), so re-measure without animating.
    let width = stage.clientWidth
    const ro = new ResizeObserver(() => {
      if (stage.clientWidth === width) return
      width = stage.clientWidth
      place(false)
    })
    ro.observe(stage)
    return () => { live = false; ro.disconnect(); timers.forEach(clearTimeout) }
  }, [active])

  return (
    <div ref={layer} className="v3-gl" aria-hidden="true">
      {Array.from({ length: GLASS_POOL }, (_, i) => <i key={i} className="v3-gl-pane" />)}
    </div>
  )
}
