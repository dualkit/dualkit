'use client'
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { V3 } from '@/lib/v3/copy'
import { DESIGN_H, DESIGN_W, ORIGIN_CITY, phoneCrop } from '@/lib/v3/grid'
import { useSequence } from '@/lib/v3/inview'
import { runDir, type CityExample } from '@/lib/v3/region-examples'
import { GRID } from '@/lib/v3/region-grid'
import { arcPath, pickVia, selectReducer, type PickVia, type SelectEvent } from '@/lib/v3/region-select'
import { createGulfEngine, ARC_LIFT, PHONE_QUERY, type Engine } from './gulf-engine'
import { Label } from './primitives'
import './region.css'

const R = V3.region
const FORMATS: Record<string, string> = R.formats
const CROP = phoneCrop(GRID.cities)
const CITIES = Object.entries(GRID.cities)
/** The ripple's source (Dubai): the arcs start here. */
const HOME = ORIGIN_CITY
/** Space kept between an open tag and the map's right edge. */
const EDGE = 8
/** A tag's offset from its point (region.css: .v3-region-tag left), read as a constant so a flipped tag measures the same. */
const TAG_X = 10
const pct = (n: number) => `${(n * 100).toFixed(3)}%`

type Frame = { w: number; h: number; phone: boolean }
type Handlers = ReturnType<typeof useCityHandlers>

/** A city's map position in px of the map box, for the layout in use. */
function spot([x, y]: readonly [number, number], f: Frame) {
  return f.phone ? { x: ((x - CROP.x) / CROP.w) * f.w, y: ((y - CROP.y) / CROP.h) * f.h } : { x: (x / DESIGN_W) * f.w, y: (y / DESIGN_H) * f.h }
}

/**
 * Arabic runs are isolated. One of digits only (a phone number) keeps left to right, and its groups are held in order:
 * the spaces between Arabic-Indic digit groups would otherwise resolve right to left and swap the groups.
 */
function Run({ text, ar }: { text: string; ar: boolean }) {
  if (!ar) return <bdi>{text}</bdi>
  const dir = runDir(text)
  return <bdi lang="ar" dir={dir} className={dir === 'ltr' ? 'v3-region-digits' : undefined}>{text}</bdi>
}

function Example({ ex }: { ex: CityExample }) {
  return (
    <span className="v3-region-ex">
      <span><span className="v3-region-ex-in"><Run text={ex.from} ar={ex.fromAr} /> <span aria-hidden="true">→</span> <b><Run text={ex.to} ar={ex.toAr} /></b></span></span>
    </span>
  )
}

/**
 * Hover (a mouse) or focus picks a city, and leaving or blurring lets it go; a touch taps it on and off. A press also
 * focuses, so focus that comes from a pointer is skipped and the click decides.
 */
function useCityHandlers(dispatch: (e: SelectEvent) => void) {
  const pointing = useRef<string | null>(null)
  return (city: string) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') dispatch({ type: 'enter', city }) },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') dispatch({ type: 'leave', city }) },
    onPointerDown: (e: React.PointerEvent) => { pointing.current = e.pointerType },
    onFocus: () => { if (!pointing.current) dispatch({ type: 'focus', city }) },
    onBlur: () => dispatch({ type: 'blur', city }),
    onClick: () => {
      const how = pointing.current
      pointing.current = null
      if (how === 'mouse') dispatch({ type: 'enter', city })
      else if (how) dispatch({ type: 'tap', city })
    },
  })
}

type PinProps = { name: string; at: readonly [number, number]; n: number; on: boolean; flip: boolean; ex: CityExample; handlers: Handlers }

function Pin({ name, at, n, on, flip, ex, handlers }: PinProps) {
  const [x, y] = at
  const h = handlers(name)
  return (
    <span
      className="v3-region-pin"
      data-city={name}
      data-picked={on || undefined}
      data-flip={flip || undefined}
      onPointerEnter={h.onPointerEnter}
      onPointerLeave={h.onPointerLeave}
      onPointerDown={h.onPointerDown}
      onClick={h.onClick}
      style={{ '--dx': pct(x / DESIGN_W), '--dy': pct(y / DESIGN_H), '--px': pct((x - CROP.x) / CROP.w), '--py': pct((y - CROP.y) / CROP.h) } as React.CSSProperties}
    >
      <i className="v3-region-pt" aria-hidden="true" />
      <b className="v3-region-no v3-small" aria-hidden="true">{n + 1}</b>
      <button type="button" className="v3-region-tag v3-small" onFocus={h.onFocus} onBlur={h.onBlur}>
        <span>{name}</span><em>{FORMATS[name]}</em><Example ex={ex} />
      </button>
    </span>
  )
}

/** The Gulf as a dot-matrix map (the engine adds is-point and is-in to the pins, so React never rewrites their class). A ripple leaves Dubai, each city's tag drops in as it passes; on a phone the tags become a list under the map. */
export function GulfMapView({ examples }: { examples: Record<string, CityExample> }) {
  const map = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const { visible, reduced } = useSequence(map)
  const [selected, select] = useReducer(selectReducer, null)
  // A keyboard pick (Tab onto a tag) shows its open tag and arc at once; hover and tap keep their motion.
  const [via, setVia] = useState<PickVia>('pointer')
  const dispatch = useCallback((e: SelectEvent) => {
    const how = pickVia(e)
    if (how) setVia(how)
    select(e)
  }, [])
  const [frame, setFrame] = useState<Frame | null>(null)
  const [flips, setFlips] = useState<string[]>([])
  const handlers = useCityHandlers(dispatch)

  useEffect(() => {
    const root = map.current
    const el = canvas.current
    if (!root || !el) return
    engine.current = createGulfEngine(root, el, GRID, reduced)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [reduced])

  useEffect(() => {
    engine.current?.run(visible && !reduced)
  }, [visible, reduced])

  // The arc is drawn in px of the map box, so it follows the box's size and the layout (desktop or the phone crop).
  useEffect(() => {
    const root = map.current
    if (!root) return
    const read = () => setFrame({ w: root.clientWidth, h: root.clientHeight, phone: window.matchMedia(PHONE_QUERY).matches })
    const ro = new ResizeObserver(read)
    ro.observe(root)
    read()
    return () => ro.disconnect()
  }, [])

  // A tag that would run off the map once open sits to the left of its point instead, decided at its open width so it never jumps.
  useLayoutEffect(() => {
    const root = map.current
    if (!root || !frame || frame.phone) return
    let live = true
    const decide = () => {
      if (!live) return
      setFlips(Array.from(root.querySelectorAll<HTMLElement>('.v3-region-pin')).filter((pin) => {
        const tag = pin.querySelector<HTMLElement>('.v3-region-tag')
        const track = pin.querySelector<HTMLElement>('.v3-region-ex')
        const full = pin.querySelector<HTMLElement>('.v3-region-ex-in')
        if (!tag || !track || !full) return false
        return pin.offsetLeft + TAG_X + tag.offsetWidth - track.offsetWidth + full.offsetWidth > frame.w - EDGE
      }).map((pin) => pin.dataset.city ?? ''))
    }
    decide()
    void document.fonts?.ready.then(decide)
    return () => { live = false }
  }, [frame])

  const home = GRID.cities[HOME]
  const target = selected ? GRID.cities[selected] : undefined
  const arc = frame && home && target ? arcPath(spot(home, frame), spot(target, frame), ARC_LIFT) : null

  return (
    <section className="v3-region" aria-labelledby="v3-region-title" data-via={via}>
      <div className="v3-wrap">
        <div className="v3-region-head">
          <div className="v3-region-heading">
            <Label>{R.label}</Label>
            <h2 id="v3-region-title" className="v3-h2">{R.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <p className="v3-lede v3-region-lede">{R.lede}</p>
        </div>
      </div>
      <div
        ref={map}
        className="v3-region-map"
        data-selected={selected ?? undefined}
        style={{ '--phone-aspect': `${CROP.w.toFixed(2)} / ${CROP.h.toFixed(2)}` } as React.CSSProperties}
        role="group"
        aria-label={`Map of the Gulf with ${CITIES.map(([name]) => name).join(', ')} marked`}
      >
        <canvas ref={canvas} className="v3-region-canvas" aria-hidden="true" />
        <svg className="v3-region-arcs" aria-hidden="true" width="100%" height="100%">
          {arc ? <path key={selected} className="v3-region-arc" d={arc} pathLength={1} /> : null}
        </svg>
        {CITIES.map(([name, at], n) => (
          <Pin key={name} name={name} at={at} n={n} on={selected === name} flip={flips.includes(name)} ex={examples[name] as CityExample} handlers={handlers} />
        ))}
      </div>
      <div className="v3-wrap">
        <ul className="v3-region-list">
          {CITIES.map(([name], n) => (
            <li key={name} className="v3-region-item" data-picked={selected === name || undefined}>
              <button type="button" className="v3-region-row" {...handlers(name)}>
                <span className="v3-region-name"><span className="v3-small v3-region-n">{n + 1}</span><span className="v3-label-text">{name}</span></span>
                <span className="v3-small v3-region-fmt">{FORMATS[name]}</span>
                <span className="v3-small v3-region-row-ex"><Example ex={examples[name] as CityExample} /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
