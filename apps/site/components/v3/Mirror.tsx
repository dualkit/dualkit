import { SlideToPay } from '@/components/SlideToPay'
import { V3 } from '@/lib/v3/copy'
import { Frame, Label, Painting } from './primitives'
import './sec.css'
import './mirror.css'

const M = V3.mirror
const CELLS = [
  { dir: 'ltr', rtl: false, label: M.en, caption: M.captions[0] },
  { dir: 'rtl', rtl: true, label: M.ar, caption: M.captions[1] },
] as const

/** Both directions: the same slider, left to right and right to left, each on the dusk painting inside glass. */
export function Mirror() {
  return (
    <section className="v3-sec" aria-labelledby="v3-mirror-title">
      <div className="v3-wrap">
        <div className="v3-sec-head">
          <div className="v3-sec-title">
            <Label>{M.label}</Label>
            <h2 id="v3-mirror-title" className="v3-h2">{M.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <div className="v3-sec-side"><p className="v3-lede">{M.lede}</p></div>
        </div>
        <Frame className="v3-sec-body v3-mirror-frame" joins={['50%']}>
          <div className="v3-mirror-grid">
            {CELLS.map((c) => (
              <div key={c.dir} className="v3-mirror-cell">
                <Painting className="v3-mirror-paint">
                  <SlideToPay variant="glass" label={c.label} rtl={c.rtl} />
                </Painting>
                <div className="v3-mirror-caption">
                  <span className="v3-mirror-name">{c.caption}</span>
                  <span className="v3-mono" dir="ltr">{`dir="${c.dir}"`}</span>
                </div>
              </div>
            ))}
          </div>
        </Frame>
      </div>
    </section>
  )
}
