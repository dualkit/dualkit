import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx, directionOf } from './direction'

export type TabItem = { id: string; label: ReactNode; panel: ReactNode }
export type TabsProps = {
  /** Names the tab list for screen readers. */
  label: string
  items: readonly TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  className?: string
}

/**
 * The WAI-ARIA tabs pattern with automatic activation. Arrow keys move towards the
 * reading end, so ArrowLeft goes forward in Arabic; Home and End do not change.
 */
export function Tabs({ label, items, value, defaultValue, onValueChange, className }: TabsProps) {
  const [own, setOwn] = useState(defaultValue ?? items[0]?.id)
  const current = value ?? own
  const base = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const tabId = (id: string) => `${base}-tab-${id}`
  const panelId = (id: string) => `${base}-panel-${id}`

  const select = (k: number) => {
    const item = items[k]
    if (!item) return
    refs.current[k]?.focus()
    if (item.id === current) return
    if (value === undefined) setOwn(item.id)
    onValueChange?.(item.id)
  }

  const onKeyDown = (k: number, e: KeyboardEvent<HTMLButtonElement>) => {
    const n = items.length
    const forward = directionOf(e.currentTarget) === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'
    const target = e.key === forward ? (k + 1) % n : e.key === back ? (k - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (target < 0) return
    e.preventDefault()
    select(target)
  }

  const active = items.find((i) => i.id === current) ?? items[0]
  return (
    <div className={cx('dk-tabs', className)}>
      <div className="dk-tabs__list" role="tablist" aria-label={label}>
        {items.map((item, k) => {
          const on = item.id === active?.id
          return (
            <button key={item.id} ref={(el) => { refs.current[k] = el }} type="button" role="tab" id={tabId(item.id)}
              className="dk-tabs__tab" aria-selected={on} aria-controls={panelId(item.id)} tabIndex={on ? 0 : -1}
              onClick={() => select(k)} onKeyDown={(e) => onKeyDown(k, e)}>
              {item.label}
            </button>
          )
        })}
      </div>
      {items.map((item) => (
        <div key={item.id} className="dk-tabs__panel" role="tabpanel" id={panelId(item.id)} aria-labelledby={tabId(item.id)}
          tabIndex={0} hidden={item.id !== active?.id}>
          {item.panel}
        </div>
      ))}
    </div>
  )
}
