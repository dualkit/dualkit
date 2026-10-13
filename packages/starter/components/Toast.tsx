import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './direction'
import { Icon, type IconName } from './icons'
import { useSwipeDismiss } from './useSwipeDismiss'

export type ToastTone = 'neutral' | 'success' | 'error'
export type ToastProps = {
  message: ReactNode
  tone?: ToastTone
  action?: { label: ReactNode; onAction: () => void }
  onDismiss?: () => void
  /** Milliseconds before it dismisses itself. Paused while hovered or focused. Leave out to keep it. */
  duration?: number
  className?: string
}

const GLYPH: Record<ToastTone, IconName> = { neutral: 'info', success: 'check', error: 'alert' }

/**
 * A status message. Mixed Arabic and English reads in order because the message is one
 * bidi paragraph in the page direction. Swipe towards the inline end, or press Escape, to dismiss.
 */
export function Toast({ message, tone = 'neutral', action, onDismiss, duration, className }: ToastProps) {
  const swipe = useSwipeDismiss(onDismiss)
  const [paused, setPaused] = useState(false)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (!duration || paused) return
    const timer = setTimeout(() => dismiss.current?.(), duration)
    return () => clearTimeout(timer)
  }, [duration, paused])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && onDismiss) { e.stopPropagation(); onDismiss() }
  }

  return (
    <div role="status" data-tone={tone} className={cx('dk-toast', swipe.dragging && 'dk-is-dragging', className)}
      style={swipe.offset ? { translate: `${swipe.offset}px 0` } : undefined}
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown} {...swipe.handlers}>
      <Icon name={GLYPH[tone]} />
      <p className="dk-toast__message dk-body">{message}</p>
      {action && <button type="button" className="dk-toast__action dk-label" onClick={action.onAction}>{action.label}</button>}
    </div>
  )
}

/** Holds toasts in the corner the page reads towards, newest at the bottom. */
export function ToastRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <section className={cx('dk-toast-region', className)} aria-label={label}>{children}</section>
}
