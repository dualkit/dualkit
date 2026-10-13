'use client'
import { useEffect } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/** Blur-rise (800ms) for anything marked .reveal that starts below the fold. Visible at rest. */
export function Reveal() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return
      io.unobserve(e.target)
      e.target.animate([{ opacity: 0, transform: 'translateY(20px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 800, easing: 'ease' })
    }), { threshold: 0.15 })
    document.querySelectorAll('section h2, .sec-lede, .card, .demo, .pipe, .reveal, .f-grid').forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return null
}
