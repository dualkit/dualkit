import Link from 'next/link'
import type { CSSProperties, ElementType, ReactNode } from 'react'

const cx = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ')
const TICK_HALF = 'calc(var(--v3-tick) / -2 - 0.5px)'

const ARROW = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

/** Hairline box with 7px ink ticks on its corners and at each `joins` x (px from the left edge, or any CSS length, on top and bottom). */
export function Frame({ joins = [], children, className }: { joins?: Array<number | string>; children?: ReactNode; className?: string }) {
  const spot = (left: string, top: string): CSSProperties => ({ left, top })
  const corners = [spot(TICK_HALF, TICK_HALF), spot('calc(100% - var(--v3-tick) / 2 - 0.5px)', TICK_HALF), spot(TICK_HALF, 'calc(100% - var(--v3-tick) / 2 - 0.5px)'), spot('calc(100% - var(--v3-tick) / 2 - 0.5px)', 'calc(100% - var(--v3-tick) / 2 - 0.5px)')]
  const at = (x: number | string) => `calc(${typeof x === 'number' ? `${x}px` : x} - var(--v3-tick) / 2)`
  const edges = joins.flatMap((x) => [spot(at(x), TICK_HALF), spot(at(x), 'calc(100% - var(--v3-tick) / 2 - 0.5px)')])
  return (
    <div className={cx('v3-frame', className)}>
      {[...corners, ...edges].map((style, i) => <span key={i} className="v3-tick" style={style} aria-hidden="true" />)}
      {children}
    </div>
  )
}

/** Section label: 7px ink square plus a 14px sentence-case label. */
export function Label({ children }: { children: ReactNode }) {
  return <span className="v3-label">{children}</span>
}

export function Button({ href, kind, arrow = false, children }: { href: string; kind: 'ink' | 'outline' | 'glass'; arrow?: boolean; children: ReactNode }) {
  const className = `v3-btn v3-btn--${kind}`
  const body = <>{children}{arrow ? ARROW : null}</>
  return /^https?:/.test(href)
    ? <a className={className} href={href} rel="noopener noreferrer">{body}</a>
    : <Link className={className} href={href}>{body}</Link>
}

/** Smoked glass: translucent fill, blur, a 1px ring. */
export function Glass({ as, className, children }: { as?: ElementType; className?: string; children?: ReactNode }) {
  const Tag = as ?? 'div'
  return <Tag className={cx('v3-glass', className)}>{children}</Tag>
}

/** The dusk painting as a background; children sit on top. */
export function Painting({ src = 'dusk', className, children }: { src?: 'dusk'; className?: string; children?: ReactNode }) {
  return <div className={cx('v3-painting', className)} data-painting={src}>{children}</div>
}

/** An Arabic run: always lang="ar" and dir="rtl". */
export function Ar({ children, as }: { children: ReactNode; as?: ElementType }) {
  const Tag = as ?? 'span'
  return <Tag lang="ar" dir="rtl">{children}</Tag>
}
