'use client'
import { useEffect, useReducer, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { clickVia } from '@/lib/v3/menu'
import { kitInitial, kitKeyEvent, kitReducer, type KitEvent } from '@/lib/v3/kit-accordion'
import { GlassLayer } from './GlassLayer'
import { Frame, Painting } from './primitives'

export type KitItem = { name: string; no: string; title: string | null; body: string; points: readonly string[] }

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Buttons that each own a panel; one panel is open. The preview pane beside the list (wide screens) and the one
 *  inside each panel (phones) both come from `previews`; CSS shows one of them. */
export function KitAccordion({ items, previews }: { items: readonly KitItem[]; previews: readonly ReactNode[] }) {
  const count = items.length
  const [state, dispatch] = useReducer((s: ReturnType<typeof kitInitial>, e: KitEvent) => kitReducer(s, e, count), undefined, kitInitial)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const moved = useRef(false)

  useEffect(() => {
    if (moved.current) buttons.current[state.focus]?.focus()
  }, [state.focus])

  const onKey = (e: KeyboardEvent) => {
    const event = kitKeyEvent(e.key)
    if (!event) return
    e.preventDefault()
    moved.current = true
    dispatch(event)
  }

  return (
    <Frame className="v3-kit-frame" joins={[560]} data-via={state.via}>
      <div className="v3-kit-list">
        {items.map((item, k) => {
          const open = state.open === k
          return (
            <div key={item.name} className="v3-kit-item" data-open={open ? '' : undefined}>
              <h3 className="v3-kit-h">
                <button
                  ref={(el) => { buttons.current[k] = el }}
                  type="button"
                  className="v3-kit-btn"
                  id={`v3-kit-btn-${k}`}
                  aria-expanded={open}
                  aria-controls={`v3-kit-panel-${k}`}
                  onClick={(e) => dispatch({ type: 'open', index: k, via: clickVia(e.detail) })}
                  onFocus={() => dispatch({ type: 'focus', index: k })}
                  onKeyDown={onKey}
                >
                  <span className="v3-kit-name"><span className="v3-small v3-kit-no">{item.no}</span><span className="v3-step">{item.name}</span></span>
                  <span className="v3-kit-square" aria-hidden="true" />
                </button>
              </h3>
              <div className="v3-kit-collapse" id={`v3-kit-panel-${k}`} role="region" aria-labelledby={`v3-kit-btn-${k}`} inert={!open}>
                <div className="v3-kit-clip">
                  <div className="v3-kit-detail">
                    {item.title ? <p className="v3-step v3-kit-title">{item.title}</p> : null}
                    <p className="v3-body v3-kit-body">{item.body}</p>
                    {item.points.length ? (
                      <ul className="v3-kit-points">
                        {item.points.map((p) => <li key={p} className="v3-body"><span className="v3-kit-tick">{CHECK}</span>{p}</li>)}
                      </ul>
                    ) : null}
                  </div>
                  <Painting className="v3-kit-inline">{previews[k]}</Painting>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <Painting className="v3-kit-pane">
        <GlassLayer active={state.open} animate={state.via !== 'keyboard'} />
        {previews.map((preview, k) => (
          <div key={items[k]?.name ?? k} className="v3-kit-shot" data-on={state.open === k ? '' : undefined} inert={state.open !== k} aria-hidden={state.open !== k}>{preview}</div>
        ))}
      </Painting>
    </Frame>
  )
}
