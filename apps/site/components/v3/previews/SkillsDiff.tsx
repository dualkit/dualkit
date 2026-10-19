import { V3 } from '@/lib/v3/copy'
import { Ar, Glass } from '../primitives'
import { Status } from './parts'

/** The Skills part opened: the payment summary after the agent fixed it, in the three lines the skills touched. Drawn in home.mjs skillsPanel. */
export function SkillsDiffPreview() {
  const { ar, values } = V3.story
  const k = V3.kit.skillsPanel
  const lines: Array<[string, string, boolean]> = [
    [ar.amount, ar.amountValue, false],
    [ar.phone, values.phone, true],
    [ar.panelDate, ar.dateValue, false],
  ]
  return (
    <Glass className="v3-pv v3-pv-diff">
      <div className="v3-pv-head"><Status>{k.fixed}</Status><Ar><span className="v3-pv-title">{ar.title}</span></Ar></div>
      {lines.map(([name, value, isolated]) => (
        <div key={name} className="v3-pv-diff-line">
          <span className="v3-pv-diff-value">
            {isolated ? <span className="v3-pv-tag">{V3.story.chips.bdi.replace(/[<>]/g, '')}</span> : null}
            {isolated ? <bdi lang="ar" dir="ltr">{value}</bdi> : <Ar>{value}</Ar>}
          </span>
          <Ar><span className="v3-pv-soft">{name}</span></Ar>
        </div>
      ))}
      <p className="v3-pv-note v3-pv-soft">{V3.story.panelNote}</p>
      <span className="v3-pv-view">{k.diff}</span>
    </Glass>
  )
}
