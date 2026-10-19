import { MakerMark } from '@/components/bench/MakerMark'
import { V3 } from '@/lib/v3/copy'
import { Glass } from '../primitives'

/** Three models alone, then with Dualkit. Labelled sample data until the first run on 1 November. */
export function BenchPreview() {
  const b = V3.kit.previews.bench
  return (
    <Glass className="v3-pv v3-pv-bench">
      <div className="v3-pv-head"><span className="v3-pv-title">{b.head}</span><span className="v3-pv-soft">{b.sample}</span></div>
      {V3.bench.rows.slice(0, 3).map(([name, maker, alone, withKit]) => (
        <div key={name} className="v3-pv-line">
          <span className="v3-pv-bench-head">
            <span className="v3-pv-bench-name"><MakerMark mark={maker} by={name} size={14} /><span className="v3-pv-title">{name}</span></span>
            <span className="v3-pv-bench-figures"><span className="v3-pv-soft">{alone}</span><span className="v3-pv-title">{withKit}</span><span className="v3-mono">{`+${withKit - alone}`}</span></span>
          </span>
          <span className="v3-pv-track" aria-hidden="true">
            <i className="v3-pv-lift" style={{ left: `${alone}%`, width: `${withKit - alone}%` }} />
            <i className="v3-pv-pin" style={{ left: `${alone}%` }} />
            <i className="v3-pv-pin is-on" style={{ left: `${withKit}%` }} />
          </span>
        </div>
      ))}
    </Glass>
  )
}
