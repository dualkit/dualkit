'use client'
import { useRef, type CSSProperties } from 'react'
import { WORKS_WITH } from '@/lib/marks'
import { V3 } from '@/lib/v3/copy'
import { useSequence } from '@/lib/v3/inview'
import { tileDelay } from '@/lib/v3/tile-wave'
import { Button, Frame, Label } from './primitives'
import './works.css'

const W = V3.works
const WIDE_COLUMNS = 6
const NARROW_COLUMNS = 2
const COUNT = WORKS_WITH.length + 1

const delays = (i: number) => ({ '--dw': `${tileDelay(i, WIDE_COLUMNS)}ms`, '--dn': `${tileDelay(i, NARROW_COLUMNS)}ms` }) as CSSProperties

function Mark({ path, className }: { path: string; className: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d={path} /></svg>
}

/** Opens the site feedback panel by pressing its trigger (Feedback has no other way in); a panel that is already open stays open. */
function openFeedback() {
  const trigger = document.querySelector<HTMLButtonElement>('.fb-trigger')
  if (trigger && trigger.getAttribute('aria-expanded') !== 'true') trigger.click()
}

/** Works with: five tools that Dualkit installs into and a dashed tile that opens the feedback panel. The glyph boxes flip to ink in a diagonal wave once the frame is 35% in view. */
export function WorksWith() {
  const frame = useRef<HTMLDivElement>(null)
  const { visible } = useSequence(frame)
  return (
    <section className="v3-works" aria-labelledby="v3-works-title">
      <div className="v3-wrap">
        <div className="v3-works-head">
          <div className="v3-works-heading">
            <Label>{W.label}</Label>
            <h2 id="v3-works-title" className="v3-h2">{W.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <div className="v3-works-side">
            <p className="v3-lede v3-works-lede">{W.lede}</p>
            <Button href="/docs" kind="ink" arrow>{W.action}</Button>
          </div>
        </div>
        <div ref={frame} className="v3-works-wave" data-on={visible ? '' : undefined}>
          <Frame className="v3-works-frame" joins={['calc(100% / 6)', 'calc(100% * 2 / 6)', 'calc(100% * 3 / 6)', 'calc(100% * 4 / 6)', 'calc(100% * 5 / 6)']}>
            <div className="v3-works-grid">
            {WORKS_WITH.map((tool, i) => (
              <a key={tool.name} className="v3-works-tile" href={tool.href} style={delays(i)}>
                <span className="v3-works-box"><span className="v3-works-ink" /><Mark className="v3-works-mark" path={tool.path} /><Mark className="v3-works-mark v3-works-mark--w" path={tool.path} /></span>
                <span className="v3-works-words"><span className="v3-label-text">{tool.name}</span><span className="v3-small v3-works-role">{W.tools[i]?.[1]}</span></span>
              </a>
            ))}
            <button type="button" className="v3-works-tile v3-works-ask" style={delays(COUNT - 1)} onClick={openFeedback} aria-haspopup="dialog">
              <span className="v3-works-box v3-works-box--dashed"><span aria-hidden="true">+</span></span>
              <span className="v3-works-words"><span className="v3-label-text">{W.ask[0]}</span><span className="v3-small v3-works-role">{W.ask[1]}</span></span>
            </button>
            </div>
          </Frame>
        </div>
      </div>
    </section>
  )
}
