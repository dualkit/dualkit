import { MCP_COMMAND } from '@/lib/copy'
import { V3 } from '@/lib/v3/copy'
import { Glass } from '../primitives'
import { Status } from './parts'

/** @dualkit/mcp: its four tools and what each one does, the first one lit, over the install line. Server-safe. */
export function McpPreview() {
  const m = V3.kit.previews.mcp
  return (
    <Glass className="v3-pv v3-pv-skills v3-pv-mcp">
      <div className="v3-pv-head"><span className="v3-pv-title">{m.title}</span><Status>{m.status}</Status></div>
      {m.tools.map(([name, what], k) => (
        <div key={name} className={`v3-pv-skill${k === 0 ? ' is-on' : ''}`}>
          <span className="v3-mono">{name}</span>
          <span className="v3-pv-soft">{what}</span>
        </div>
      ))}
      <div className="v3-pv-install"><span className="v3-mono v3-pv-fill">{MCP_COMMAND}</span></div>
    </Glass>
  )
}
