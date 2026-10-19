'use client'
import { useEffect, useRef } from 'react'
import { V3 } from '@/lib/v3/copy'
import { DESIGN_H, DESIGN_W, decodeGrid, phoneCrop, type GridJson } from '@/lib/v3/grid'
import { useSequence } from '@/lib/v3/inview'
import data from '../../public/v3/gulf-grid.json'
import { createGulfEngine, type Engine } from './gulf-engine'
import { Label } from './primitives'
import './region.css'

const R = V3.region
const GRID = decodeGrid(data as unknown as GridJson)
const FORMATS: Record<string, string> = R.formats
const CROP = phoneCrop(GRID.cities)
const CITIES = Object.entries(GRID.cities)
const pct = (n: number) => `${(n * 100).toFixed(3)}%`

/** The Gulf as a dot-matrix map. A ripple leaves Dubai, each city's tag drops in as it passes; on a phone the tags become a list under the map. */
export function GulfMap() {
  const map = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const { visible, reduced } = useSequence(map)

  useEffect(() => {
    const root = map.current
    const el = canvas.current
    if (!root || !el) return
    if (!reduced) root.dataset.armed = ''
    else delete root.dataset.armed
    engine.current = createGulfEngine(root, el, GRID, reduced)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [reduced])

  useEffect(() => {
    engine.current?.run(visible && !reduced)
  }, [visible, reduced])

  return (
    <section className="v3-region" aria-labelledby="v3-region-title">
      <div className="v3-wrap">
        <div className="v3-region-head">
          <div className="v3-region-heading">
            <Label>{R.label}</Label>
            <h2 id="v3-region-title" className="v3-h2">{R.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <p className="v3-lede v3-region-lede">{R.lede}</p>
        </div>
      </div>
      <div ref={map} className="v3-region-map" style={{ '--phone-aspect': `${CROP.w.toFixed(2)} / ${CROP.h.toFixed(2)}` } as React.CSSProperties} role="img" aria-label={`Map of the Gulf with ${CITIES.map(([name]) => name).join(', ')} marked`}>
        <canvas ref={canvas} className="v3-region-canvas" aria-hidden="true" />
        {CITIES.map(([name, [x, y]], n) => (
          <span
            key={name}
            className="v3-region-pin"
            data-city={name}
            aria-hidden="true"
            style={{ '--dx': pct(x / DESIGN_W), '--dy': pct(y / DESIGN_H), '--px': pct((x - CROP.x) / CROP.w), '--py': pct((y - CROP.y) / CROP.h) } as React.CSSProperties}
          >
            <i className="v3-region-pt" />
            <b className="v3-region-no v3-small">{n + 1}</b>
            <span className="v3-region-tag v3-small">{name}<em>{FORMATS[name]}</em></span>
          </span>
        ))}
      </div>
      <div className="v3-wrap">
        <ul className="v3-region-list">
          {CITIES.map(([name], n) => (
            <li key={name} className="v3-region-item">
              <span className="v3-region-name"><span className="v3-small v3-region-n">{n + 1}</span><span className="v3-label-text">{name}</span></span>
              <span className="v3-small v3-region-fmt">{FORMATS[name]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
