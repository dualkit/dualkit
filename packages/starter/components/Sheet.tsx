import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './direction'
import { Icon } from './icons'
import { useSwipeDismiss } from './useSwipeDismiss'

export type SheetProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** The close button's name for screen readers, in the page language. */
  closeLabel?: string
  className?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A modal side sheet. It opens from the inline end (right in English, left in Arabic),
 * keeps focus inside, closes on Escape, the scrim or a swipe back towards its edge,
 * and gives focus back to whatever opened it. It renders in place, so it keeps the
 * dir and lang of the subtree it sits in.
 */
export function Sheet({ open, onClose, title, children, footer, closeLabel = 'Close', className }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const swipe = useSwipeDismiss(onClose)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0], last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <div className={cx('dk-sheet', className)} onKeyDown={onKeyDown}>
      <div className="dk-sheet__scrim" aria-hidden="true" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cx('dk-sheet__panel', swipe.dragging && 'dk-is-dragging')}
        style={swipe.offset ? { translate: `${swipe.offset}px 0` } : undefined} {...swipe.handlers}>
        <div className="dk-sheet__header">
          <h2 id={titleId} className="dk-title">{title}</h2>
          <button type="button" className="dk-sheet__close" aria-label={closeLabel} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="dk-sheet__body">{children}</div>
        {footer != null && <div className="dk-sheet__footer">{footer}</div>}
      </div>
    </div>
  )
}

/** A label and value on one line. Identifiers such as an IBAN go in mono and stay left to right. */
export function SheetRow({ label, value, mono = false }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="dk-sheet__row">
      <span className="dk-body dk-secondary">{label}</span>
      {mono ? <span className="dk-mono" dir="ltr">{value}</span> : <bdi className="dk-body">{value}</bdi>}
    </div>
  )
}
