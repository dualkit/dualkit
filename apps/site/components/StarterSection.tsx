import { COPY, STARTER_COMMAND } from '@/lib/copy'
import { CopyCommand } from './CopyCommand'
import { StarterTiles } from './StarterTiles'

export function StarterSection() {
  const s = COPY.starter
  return (
    <section id="starter" className="section">
      <div className="st-head">
        <div className="st-copy">
          <h2 className="h2">{s.heading[0]}<br />{s.heading[1]}</h2>
          <p className="lede">{s.lede}</p>
        </div>
        <CopyCommand command={STARTER_COMMAND} />
      </div>
      <StarterTiles />
    </section>
  )
}
