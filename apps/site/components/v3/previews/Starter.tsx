import { V3 } from '@/lib/v3/copy'
import { Ar, Glass } from '../primitives'

/** The eight Starter components as glass cells; Amount shows both directions. */
export function StarterPreview() {
  const s = V3.kit.previews.starter
  return (
    <div className="v3-pv v3-pv-starter">
      {s.components.map((name) => (
        <Glass key={name} className="v3-pv-cell">
          <span className="v3-mono">{name}</span>
          {name === 'Amount' ? <span className="v3-pv-amount"><span className="v3-pv-title">{s.amount.en}</span><Ar>{s.amount.ar}</Ar></span> : null}
        </Glass>
      ))}
    </div>
  )
}
