import { V3 } from '@/lib/v3/copy'
import { Glass } from '../primitives'
import { PvArrow, Status } from './parts'

/** dualkit convert on TailAdmin: three of its real edits and the run's summary. Server-safe. */
export function ConvertPreview() {
  const c = V3.kit.previews.convert
  return (
    <Glass className="v3-pv v3-pv-convert">
      <div className="v3-pv-head"><span className="v3-pv-title">{c.title}</span><Status>{c.status}</Status></div>
      {c.edits.map(([from, to]) => (
        <div key={from} className="v3-pv-line v3-pv-edit">
          <span className="v3-mono v3-pv-from">{from}</span>
          <span className="v3-pv-soft"><PvArrow /></span>
          <span className="v3-mono">{to}</span>
        </div>
      ))}
      <div className="v3-pv-install">
        <span className="v3-mono v3-pv-fill">{c.branch}</span>
        <span className="v3-pv-soft">{c.summary.join(', ')}</span>
      </div>
    </Glass>
  )
}
