import { COPY } from '@/lib/copy'
import { Pipeline } from './Pipeline'

export function StarterSection() {
  const s = COPY.starter
  return (
    <section id="starter" className="section">
      <div className="centre-head">
        <span className="tag">{s.tag}</span>
        <h2 className="h2">{s.heading[0]}<br />{s.heading[1]}</h2>
        <p className="lede">{s.lede}</p>
      </div>
      <Pipeline />
    </section>
  )
}
