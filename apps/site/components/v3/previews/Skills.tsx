import { V3 } from '@/lib/v3/copy'
import { Glass } from '../primitives'
import { Status } from './parts'

/** The four skills and when each loads, the first one lit. Server-safe; drawn in design/figma/gen/v3/menu.mjs. */
export function SkillsPreview() {
  const s = V3.menu.skills
  return (
    <Glass className="v3-pv v3-pv-skills">
      <div className="v3-pv-head"><span className="v3-pv-title">{s.head}</span><Status>{s.ready}</Status></div>
      {s.rows.map(([name, when], k) => (
        <div key={name} className={`v3-pv-skill${k === 0 ? ' is-on' : ''}`}>
          <span className="v3-pv-skill-start"><span className="v3-pv-soft">{k + 1}</span><span className="v3-mono">{name}</span></span>
          <span className="v3-pv-soft">{when}</span>
        </div>
      ))}
    </Glass>
  )
}
