import { useRef, useState, type PointerEvent } from 'react'
import { inlineSign } from './direction'

const THRESHOLD = 64

/**
 * Drag towards the inline end to dismiss: right in English, left in Arabic.
 * The direction is read when the drag starts, so it follows the element's own dir.
 */
export function useSwipeDismiss(onDismiss: (() => void) | undefined) {
  const start = useRef<{ x: number; sign: 1 | -1; id: number } | null>(null)
  const [offset, setOffset] = useState(0)

  const distance = (e: PointerEvent) => (start.current ? (e.clientX - start.current.x) * start.current.sign : 0)

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (!onDismiss || e.button !== 0) return
      if ((e.target as Element).closest('button, a, input, textarea, select')) return
      start.current = { x: e.clientX, sign: inlineSign(e.currentTarget), id: e.pointerId }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (!start.current || e.pointerId !== start.current.id) return
      // Only the dismissing way moves freely; the other way is held at zero.
      setOffset(Math.max(0, distance(e)) * start.current.sign)
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      if (!start.current || e.pointerId !== start.current.id) return
      const travelled = distance(e)
      start.current = null
      setOffset(0)
      if (travelled > THRESHOLD) onDismiss?.()
    },
    onPointerCancel() {
      start.current = null
      setOffset(0)
    },
  }

  return { handlers, offset, dragging: offset !== 0 }
}
