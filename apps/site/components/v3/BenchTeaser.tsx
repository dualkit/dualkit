import { MakerMark } from '@/components/bench/MakerMark'
import { latestBenchMonth } from '@/lib/bench'
import { benchRows } from '@/lib/v3/bench-rows'
import { V3 } from '@/lib/v3/copy'
import { Button, Frame, Label } from './primitives'
import './sec.css'
import './bench-teaser.css'

const B = V3.bench
// Not in the copy object; they come from the approved Figma frames (gen/v3/home.mjs bench()).
const ALONE = 'Alone'
const WITH_DUALKIT = 'With Dualkit'

function Track({ alone, dualkit }: { alone: number; dualkit: number }) {
  return (
    <span className="v3-bt-track" aria-hidden="true">
      <i className="v3-bt-lift" style={{ left: `${alone}%`, width: `${dualkit - alone}%` }} />
      <i className="v3-bt-dot" style={{ left: `${alone}%` }} />
      <i className="v3-bt-dot is-on" style={{ left: `${dualkit}%` }} />
    </span>
  )
}

/** The Bench teaser: the latest month's top four models, alone and with Dualkit, or the labelled sample rows until the first run. */
export function BenchTeaser() {
  const { rows, sample } = benchRows(latestBenchMonth())
  return (
    <section className="v3-sec" aria-labelledby="v3-bench-title">
      <div className="v3-wrap">
        <div className="v3-sec-head">
          <div className="v3-sec-title">
            <Label>{B.label}</Label>
            <h2 id="v3-bench-title" className="v3-h2">{B.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <div className="v3-sec-side">
            <p className="v3-lede">{B.lede}</p>
            <Button href="/bench" kind="outline" arrow>{B.action}</Button>
          </div>
        </div>
        <Frame className="v3-sec-body">
          <div className="v3-bt-legend">
            <span className="v3-bt-key"><i className="v3-bt-dot v3-bt-dot--static" />{ALONE}</span>
            <span className="v3-bt-key"><i className="v3-bt-dot v3-bt-dot--static is-on" />{WITH_DUALKIT}</span>
            {sample ? <span className="v3-bt-sample">{V3.kit.previews.bench.sample}</span> : null}
          </div>
          <ol className="v3-bt-rows">
            {rows.map((r, k) => (
              <li key={r.name} className="v3-bt-row">
                <span className="v3-bt-name">
                  <span className="v3-bt-rank">{k + 1}</span>
                  <MakerMark mark={r.maker} by={r.name} size={16} />
                  <span className="v3-bt-model">{r.name}</span>
                </span>
                <Track alone={r.alone} dualkit={r.dualkit} />
                <span className="v3-bt-figures">
                  <span className="v3-bt-alone">{r.alone}</span>
                  <span className="v3-bt-model">{r.dualkit}</span>
                  <span className="v3-mono">{`+${r.dualkit - r.alone}`}</span>
                </span>
              </li>
            ))}
          </ol>
        </Frame>
      </div>
    </section>
  )
}
