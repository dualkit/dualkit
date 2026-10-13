import { COPY } from '@/lib/copy'
import { Odometer } from './Odometer'

export function Strip() {
  return (
    <div className="strip">
      {COPY.strip.map((s) => (
        <div key={s.label}><span className="src">{s.source}</span><Odometer value={s.value} /><span className="cap">{s.label}</span></div>
      ))}
    </div>
  )
}
