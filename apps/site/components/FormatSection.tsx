import { COPY } from '@/lib/copy'
import { FormatTile } from './FormatTile'

export function FormatSection() {
  const f = COPY.format
  return (
    <section id="format" className="section">
      <div className="format-row">
        <FormatTile />
        <div className="format-copy">
          <h2 className="h2">{f.heading[0]}<br />{f.heading[1]}</h2>
          <p className="lede">{f.lede}</p>
          <div className="points">{f.points.map(([t, l]) => <div key={t}><strong>{t}</strong><span>{l}</span></div>)}</div>
        </div>
      </div>
    </section>
  )
}
