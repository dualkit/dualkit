import { V3 } from '@/lib/v3/copy'
import { Glass } from '../primitives'

/** Dualkit for Figma: its two commands. It is not on Figma Community yet, so the status has no green dot. Server-safe. */
export function FigmaPreview() {
  const f = V3.kit.previews.figma
  return (
    <Glass className="v3-pv v3-pv-skills v3-pv-figma">
      <div className="v3-pv-head"><span className="v3-pv-title">{f.title}</span><span className="v3-pv-status">{f.status}</span></div>
      {f.commands.map(([name, what], k) => (
        <div key={name} className={`v3-pv-skill${k === 0 ? ' is-on' : ''}`}>
          <span>{name}</span>
          <span className="v3-pv-soft">{what}</span>
        </div>
      ))}
    </Glass>
  )
}
