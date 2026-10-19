'use client'
import { useEffect, useState, type RefObject } from 'react'
import { prefersReducedMotion } from '../motion'

/** visible = intersecting at threshold and tab not hidden; reduced tracks the media query live. */
export function useSequence(ref: RefObject<Element | null>, { threshold = 0.35 }: { threshold?: number } = {}) {
  const [intersecting, setIntersecting] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setIntersecting(entry?.isIntersecting ?? false), { threshold })
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
    setReduced(prefersReducedMotion())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return { visible: intersecting && tabVisible, reduced }
}
