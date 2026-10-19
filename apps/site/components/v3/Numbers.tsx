import { numbersStats } from '@/lib/v3/numbers'
import { V3 } from '@/lib/v3/copy'
import { Frame, Label } from './primitives'
import { NumbersGrid } from './NumbersGrid'
import './sec.css'
import './numbers.css'

const N = V3.numbers

/** In numbers: four counters, each read from its source at build time (tests, rules, currencies, skills). */
export function Numbers() {
  const stats = numbersStats()
  return (
    <section className="v3-sec" aria-labelledby="v3-numbers-title">
      <div className="v3-wrap">
        <div className="v3-sec-title">
          <Label>{N.label}</Label>
          <h2 id="v3-numbers-title" className="v3-h2">{N.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
        </div>
        <Frame className="v3-sec-body v3-num-frame" joins={['25%', '50%', '75%']}>
          <NumbersGrid stats={stats} />
        </Frame>
      </div>
    </section>
  )
}
