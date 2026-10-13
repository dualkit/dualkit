import { COPY } from '@/lib/copy'
import { Odometer } from './Odometer'

export function Strip() {
  return (
    <section className="section">
      <div className="strip">
        {COPY.strip.map(([value, label]) => <div key={label}><Odometer value={value} /><span className="small soft">{label}</span></div>)}
      </div>
    </section>
  )
}
