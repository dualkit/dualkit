import { V3 } from '@/lib/v3/copy'
import { parsedFormatLines } from '@/lib/v3/kit-data'
import { Ar, Glass } from '../primitives'
import { PvArrow, PvCopy, Status } from './parts'

/** A phone number stays left to right even inside Arabic, isolated in its own run (the bidi rule Dualkit teaches). */
const LTR_RUNS = new Set(['Phone'])

/** What people type in Arabic digits and what @dualkit/format reads from it, parsed when the page renders. */
export function FormatPreview() {
  const f = V3.kit.previews.format
  return (
    <Glass className="v3-pv v3-pv-format">
      <div className="v3-pv-head"><Status>{f.status}</Status><span className="v3-mono">{f.package}</span></div>
      {parsedFormatLines().map(({ what, ar, out }) => (
        <div key={what} className="v3-pv-line">
          <span className="v3-pv-soft">{what}</span>
          <span className="v3-pv-parse">
            {LTR_RUNS.has(what) ? <bdi lang="ar" dir="ltr">{ar}</bdi> : <Ar>{ar}</Ar>}
            <span className="v3-pv-result"><span className="v3-pv-soft"><PvArrow /></span><span className="v3-mono">{out}</span></span>
          </span>
        </div>
      ))}
      <div className="v3-pv-install"><span className="v3-mono v3-pv-soft">$</span><span className="v3-mono v3-pv-fill">{f.install}</span><span className="v3-pv-soft"><PvCopy /></span></div>
    </Glass>
  )
}
