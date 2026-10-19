import { V3 } from '@/lib/v3/copy'
import { Check } from './how/Check'
import { Connect } from './how/Connect'
import { Ranked } from './how/Ranked'
import { Frame, Label, Painting } from './primitives'
import './how.css'

const H = V3.how
const MEDIA = [<Connect key="c" />, <Ranked key="r" />, <Check key="k" />]
const JOINS = ['calc(100% / 3)', 'calc(100% * 2 / 3)']

/** How it works: label, heading and lede above a ruled frame of three cells, each a small painting with one piece of glass UI. */
export function HowItWorks() {
  return (
    <section className="v3-how" aria-labelledby="v3-how-title">
      <div className="v3-wrap">
        <div className="v3-how-head">
          <div className="v3-how-heading">
            <Label>{H.label}</Label>
            <h2 id="v3-how-title" className="v3-h2">{H.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <p className="v3-lede v3-how-lede">{H.lede}</p>
        </div>
        <Frame className="v3-how-frame" joins={JOINS}>
          {H.steps.map(([no, title, body], k) => (
            <article key={no} className="v3-how-cell">
              <Painting className="v3-how-art">{MEDIA[k]}</Painting>
              <div className="v3-how-text">
                <span className="v3-small v3-how-no">{no}</span>
                <h3 className="v3-step">{title}</h3>
                <p className="v3-body v3-how-body">{body}</p>
              </div>
            </article>
          ))}
        </Frame>
      </div>
    </section>
  )
}
