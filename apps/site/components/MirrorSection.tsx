import { COPY } from '@/lib/copy'
import { Halftone } from './Halftone'
import { SlideToPay } from './SlideToPay'

export function MirrorSection() {
  const m = COPY.mirror
  return (
    <section className="section">
      <div className="mirror-row">
        <Halftone hint={m.hint} />
        <div className="mirror-copy">
          <h2 className="h2">{m.heading[0]}<br />{m.heading[1]}</h2>
          <p className="lede">{m.lede}</p>
          <div className="sliders">
            <div className="labels"><span>Left to right</span><span>Right to left</span></div>
            <SlideToPay label={m.slide.en} done={m.slide.enDone} />
            <SlideToPay label={m.slide.ar} done={m.slide.arDone} rtl />
          </div>
        </div>
      </div>
    </section>
  )
}
