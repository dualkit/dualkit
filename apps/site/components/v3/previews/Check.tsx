import { V3 } from '@/lib/v3/copy'
import { checkFamilies, ruleCount } from '@/lib/v3/kit-data'
import { Glass } from '../primitives'
import { PvCheck } from './parts'

/** A passing dualkit check report: every family full. The counts come from RULES in @dualkit/rules. */
export function CheckPreview() {
  const c = V3.kit.previews.check
  const n = ruleCount()
  return (
    <Glass className="v3-pv v3-pv-check">
      <div className="v3-pv-head">
        <span className="v3-pv-check-title"><span className="v3-pv-check-box"><PvCheck /></span><span className="v3-pv-title">{c.title}</span></span>
        <span className="v3-pv-status"><i className="v3-pv-dot" aria-hidden="true" />{`${n} of ${n}`}</span>
      </div>
      <div>
        {checkFamilies().map(([name, count]) => (
          <div key={name} className="v3-pv-family">
            <span className="v3-pv-title v3-pv-family-name">{name}</span>
            <span className="v3-pv-meter"><i style={{ width: '100%' }} /></span>
            <span className="v3-pv-soft">{`${count} of ${count}`}</span>
          </div>
        ))}
      </div>
      <div className="v3-pv-actions">
        <span className="v3-pv-solid"><PvCheck />{c.open}</span>
        <span className="v3-pv-ghost">{c.copy}</span>
      </div>
    </Glass>
  )
}
