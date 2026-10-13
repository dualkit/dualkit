import { COPY } from '@/lib/copy'
import tools from '@/lib/tools.json'

// Tool marks from Simple Icons 16.33.0. Moves at 32px/s and pauses on hover; the track is doubled for the loop.
const SPEED = 32
const ITEM_WIDTH_ESTIMATE = 190

export function WorksWith() {
  const items = tools.map((t) => (
    <span className="tool" key={t.label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={t.d} /></svg>
      {t.label}
    </span>
  ))
  const duration = `${(tools.length * ITEM_WIDTH_ESTIMATE) / SPEED}s`
  return (
    <div className="works rise" style={{ animationDelay: '950ms' }}>
      <span className="cap">{COPY.worksWith}</span>
      <div className="ticker" aria-label={`Works with ${tools.map((t) => t.label).join(', ')}`}>
        <div className="track" style={{ ['--dur' as string]: duration }} aria-hidden="true">{items}{items}</div>
      </div>
    </div>
  )
}
