'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { COPY } from '@/lib/copy'
import { ArrowIcon, ChevronIcon } from './icons'

/** Product opens a full-width drawer of three hairline columns. Escape, the scrim or a route change closes it. */
export function NavMenu() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const path = usePathname()
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div className="links">
        <button ref={button} type="button" aria-expanded={open} aria-controls="product-drawer" onClick={() => setOpen((o) => !o)}>
          {COPY.nav.product}<ChevronIcon size={12} />
        </button>
        {COPY.nav.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </div>
      <div id="product-drawer" className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="wrap drawer-grid">
          {COPY.drawer.map((d) => (
            <Link key={d.name} href={d.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              <span className="name">{d.name}<ArrowIcon className="go" /></span>
              <span className="soft">{d.line}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className={`scrim${open ? ' open' : ''}`} aria-hidden="true" onClick={() => setOpen(false)} />
    </>
  )
}
