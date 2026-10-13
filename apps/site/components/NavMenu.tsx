'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { COPY } from '@/lib/copy'
import { ArrowIcon, ChevronIcon } from './icons'

const SCROLL_CLOSE_PX = 24

/** Product opens a full-width drawer of three hairline columns. A click outside, a scroll, Escape or a route change closes it. */
export function NavMenu() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const path = usePathname()
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const openedAt = scrollY
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!drawer.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const onScroll = () => { if (Math.abs(scrollY - openedAt) > SCROLL_CLOSE_PX) setOpen(false) }
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onDown)
    addEventListener('scroll', onScroll, { passive: true })
    return () => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onDown); removeEventListener('scroll', onScroll) }
  }, [open])

  return (
    <>
      <div className="links">
        <button ref={button} type="button" aria-expanded={open} aria-controls="product-drawer" onClick={() => setOpen((o) => !o)}>
          {COPY.nav.product}<ChevronIcon size={12} />
        </button>
        {COPY.nav.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </div>
      <div id="product-drawer" ref={drawer} className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="wrap drawer-grid">
          {COPY.drawer.map((d) => (
            <Link key={d.name} href={d.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              <span className="name">{d.name}<ArrowIcon className="go" /></span>
              <span className="soft">{d.line}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
