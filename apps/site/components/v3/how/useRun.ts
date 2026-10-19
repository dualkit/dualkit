'use client'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { useSequence } from '@/lib/v3/inview'

export const EASE_UI = 'cubic-bezier(.2,0,0,1)'
export const EASE_EXPO = 'cubic-bezier(.16,1,.3,1)'
export const EASE_ODO = 'cubic-bezier(.22,1,.36,1)'

/**
 * Runs a Web Animations sequence on `ref` once it is 35% in view. The server markup is the settled state; before the
 * sequence starts, data-armed puts it in its opening state (not under reduced motion). The sequence pauses when the
 * element leaves the view or the tab hides and resumes where it stopped. `build` must be a stable function.
 */
export function useRun(ref: RefObject<HTMLElement | null>, build: (root: HTMLElement) => Animation[]) {
  const { visible, reduced } = useSequence(ref)
  const running = useRef<Animation[] | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    el.dataset.armed = '1'
    return () => {
      running.current?.forEach((a) => a.cancel())
      running.current = null
      delete el.dataset.armed
    }
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    if (!visible) {
      running.current?.forEach((a) => a.playState === 'running' && a.pause())
      return
    }
    if (!running.current) running.current = build(el)
    else running.current.forEach((a) => a.playState === 'paused' && a.play())
  }, [ref, visible, reduced, build])
}
