'use client'
import { useEffect, useState, type RefObject } from 'react'
import { prefersReducedMotion } from '../motion'

/** Pure decision: enough of the element is in view and the tab is shown. Tall elements pass when their visible height fills the threshold share of the viewport. */
export function isSequenceVisible(ratio: number, threshold: number, hidden: boolean, tall?: { rectH: number; viewH: number }): boolean {
  if (hidden) return false
  if (ratio >= threshold) return true
  return !!tall && tall.viewH > 0 && tall.rectH >= threshold * tall.viewH
}

/** visible = intersecting at threshold and tab not hidden; reduced tracks the media query live. */
export function useSequence(ref: RefObject<Element | null>, { threshold = 0.35 }: { threshold?: number } = {}) {
  const [intersecting, setIntersecting] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && prefersReducedMotion())

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return setIntersecting(false)
        setIntersecting(
          entry.isIntersecting &&
            isSequenceVisible(entry.intersectionRatio, threshold, false, { rectH: entry.intersectionRect.height, viewH: window.innerHeight }),
        )
      },
      { threshold: [0, threshold] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold])

  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return { visible: intersecting && tabVisible, reduced }
}
