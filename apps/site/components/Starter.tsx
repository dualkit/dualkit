'use client'
import { formatMoney } from '@dualkit/format'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COPY } from '@/lib/copy'
import { EASE, measureKeyed, playFlip, prefersReducedMotion } from '@/lib/motion'
import { CursorIcon } from './icons'
import { Segmented } from './Segmented'
import { RadiusSlider } from './RadiusSlider'

type Dir = 'ltr' | 'rtl'
type Hop = 'tokens' | 'figma' | 'code' | 'agents'
const MINI: Record<Dir, Record<string, string>> = {
  ltr: { t: 'Payment summary', l: 'Amount due', a: formatMoney(1234.5, { currency: 'AED' }), b: 'Pay now' },
  rtl: { t: 'ملخص الدفع', l: 'المبلغ المستحق', a: formatMoney(1234.5, { currency: 'AED', locale: 'ar' }), b: 'إتمام الدفع' },
}
const DIR_OPTIONS = [{ value: 'ltr', label: 'LTR' }, { value: 'rtl', label: 'RTL' }] as const
// When each pane receives the edit, in ms after it is made: tokens, wire, Figma, wire, code, AGENTS.md.
const TIMELINE = { wire1: 60, figma: 380, wire2: 520, code: 840, agents: 980, settle: 1500 }

function pulse(wire: HTMLElement | null) {
  const dot = wire?.querySelector('i')
  if (!wire || !dot || prefersReducedMotion()) return
  dot.getAnimations().forEach((a) => a.cancel())
  dot.animate([{ transform: 'translateX(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: `translateX(${wire.clientWidth - 8}px)`, opacity: 0 }],
    { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)' })
}

/** One token edit travelling from tokens.json to Figma to code. Every pane shows the whole current state, so an edit can interrupt another at any point. */
export function Starter() {
  const [radius, setRadius] = useState(24)
  const radiusRef = useRef(24)
  const dirRef = useRef<Dir>('rtl')
  const [dir, setDir] = useState<Dir>('rtl')
  const [shown, setShown] = useState({ figmaR: 24, figmaDir: 'rtl' as Dir, codeR: 24, codeDir: 'rtl' as Dir })
  const [lit, setLit] = useState<{ link: 'r' | 'd'; stage: Hop } | null>(null)
  const [hover, setHover] = useState<'r' | 'd' | null>(null)
  const [dragging, setDragging] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const w1 = useRef<HTMLDivElement>(null), w2 = useRef<HTMLDivElement>(null)
  const mini = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, DOMRect> | null>(null)
  const agents = useRef<HTMLSpanElement>(null)
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useLayoutEffect(() => {
    if (mini.current && before.current) playFlip(mini.current, before.current, { stagger: 30 })
    before.current = null
  }, [shown.figmaDir])

  const cancel = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const travel = (link: 'r' | 'd') => {
    cancel()
    const reduced = prefersReducedMotion()
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reduced ? 0 : ms))
    setLit({ link, stage: 'tokens' })
    later(TIMELINE.wire1, () => pulse(w1.current))
    later(TIMELINE.figma, () => {
      if (mini.current && link === 'd') before.current = measureKeyed(mini.current)
      setShown((s) => ({ ...s, figmaR: radiusRef.current, figmaDir: dirRef.current })); setLit({ link, stage: 'figma' })
    })
    later(TIMELINE.wire2, () => pulse(w2.current))
    later(TIMELINE.code, () => { setShown((s) => ({ ...s, codeR: radiusRef.current, codeDir: dirRef.current })); setLit({ link, stage: 'code' }) })
    later(TIMELINE.agents, () => {
      setLit({ link, stage: 'agents' })
      if (!reduced) agents.current?.animate([{ boxShadow: '0 0 0 0 rgba(22,163,74,.5)' }, { boxShadow: '0 0 0 8px rgba(22,163,74,0)' }], { duration: 700, easing: EASE.expo })
    })
    later(TIMELINE.settle, () => setLit(null))
  }

  // While dragging, the radius follows the finger in every pane at once; the pulse travels on release.
  const onDrag = (r: number) => { radiusRef.current = r; setRadius(r); setShown((s) => ({ ...s, figmaR: r, codeR: r })) }
  const onRelease = () => { setDragging(false); travel('r') }
  const onDir = (d: Dir) => { dirRef.current = d; setDir(d); travel('d') }
  const onStart = () => {
    // A drag takes over: finish any pending travel at once so no pane is left behind.
    cancel(); setLit(null); setDragging(true)
    setShown({ figmaR: radiusRef.current, figmaDir: dirRef.current, codeR: radiusRef.current, codeDir: dirRef.current })
  }

  const reached = (stage: Hop) => {
    if (!lit) return false
    const order: Hop[] = ['tokens', 'figma', 'code', 'agents']
    return order.indexOf(lit.stage) >= order.indexOf(stage)
  }
  const v = (link: 'r' | 'd', text: string, stage: Hop) => {
    const on = hover === link || (dragging && link === 'r') || (lit?.link === link && lit.stage === stage)
    return <span className={`v${on ? ' lit' : ''}`} onPointerEnter={() => setHover(link)} onPointerLeave={() => setHover(null)}>{text}</span>
  }
  const line = (k: number, body: React.ReactNode) => <div className="ln" key={k}><span className="no">{k + 1}</span><span>{body}</span></div>
  const m = MINI[shown.figmaDir]
  const cardLit = hover === 'r' || dragging || (lit?.link === 'r' && lit.stage === 'figma')

  return (
    <section id="starter">
      <div style={{ maxWidth: 640 }}>
        <div className="eyebrow">Starter <span className="mono tag-soon">Coming next</span></div>
        <h2>{COPY.starter.heading[0]}<br />{COPY.starter.heading[1]}</h2>
        <p className="sec-lede">{COPY.starter.lede}</p>
      </div>
      <div className="pipe" style={{ marginTop: 64 }}>
        <div className="panes">
          <div className="pane">
            <div className="pane-h"><span>tokens.json</span><span className={`meta${reached('tokens') ? ' on' : ''}`}>source</span></div>
            <div className="code">
              {line(0, '{')}{line(1, '  "radius": {')}{line(2, <>{'    "card": '}{v('r', String(radius), 'tokens')}</>)}
              {line(3, '  },')}{line(4, <>{'  "direction": '}{v('d', `"${dir}"`, 'tokens')}</>)}{line(5, '}')}
            </div>
          </div>
          <div className="wire" ref={w1}><i /></div>
          <div className="pane">
            <div className="pane-h"><span>Figma</span><span className={`meta${reached('figma') ? ' on' : ''}`}>synced</span></div>
            <div className="canvas">
              <div>
                <div className="frame-tag"><span>Card · {shown.figmaDir.toUpperCase()}</span><span>r {shown.figmaR}</span></div>
                <div className={`mini${cardLit ? ' lit' : ''}`} ref={mini} dir={shown.figmaDir} lang={shown.figmaDir === 'rtl' ? 'ar' : 'en'}
                  style={{ ['--r' as string]: `${shown.figmaR}px` }}>
                  <span className="corner" aria-hidden="true" />
                  {(['t', 'l', 'a', 'b'] as const).map((k) => <span className={k} data-k={k} key={k}><bdi suppressHydrationWarning>{m[k]}</bdi></span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="wire" ref={w2}><i /></div>
          <div className="pane">
            <div className="pane-h"><span>Code</span><span className={`meta${reached('code') ? ' on' : ''}`}>synced</span></div>
            <div className="code">
              {line(0, <>{'<Card dir='}{v('d', `"${shown.codeDir}"`, 'code')}{'>'}</>)}{line(1, '  <Amount value={1234.5} />')}
              {line(2, '  <Button>Pay now</Button>')}{line(3, '</Card>')}{line(4, '')}{line(5, <>{'// radius-card: '}{v('r', `${shown.codeR}px`, 'code')}</>)}
            </div>
          </div>
        </div>
        <div className="controls">
          <span className="try"><CursorIcon />Drag the radius, flip the direction</span>
          <div className="control-set">
            <div className="control">Radius
              <RadiusSlider value={radius} max={32} onStart={onStart} onChange={onDrag} onCommit={onRelease} />
              <span className="rval">{radius}</span>
            </div>
            <div className="control">Direction <Segmented label="Direction" options={DIR_OPTIONS} value={dir} onChange={onDir} /></div>
          </div>
          <span className={`agents${reached('agents') ? ' on' : ''}`} ref={agents}>AGENTS.md in sync</span>
        </div>
      </div>
    </section>
  )
}
