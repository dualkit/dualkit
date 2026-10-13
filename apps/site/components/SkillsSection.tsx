import { COPY } from '@/lib/copy'
import { Ticks } from './Ticks'

const TOTAL = 24
const asTicks = (score: number) => Math.round((score / 3) * TOTAL)

export function SkillsSection() {
  const s = COPY.skills
  return (
    <section id="skills" className="section">
      <div className="split-head">
        <h2 className="h2">{s.heading[0]}<br />{s.heading[1]}</h2>
        <p className="lede">{s.lede}</p>
      </div>
      <div className="tile skill-cells">
        {s.cells.map((c) => (
          <a className="skill-cell" key={c.name} href={`https://github.com/dualkit/dualkit/tree/main/skills/${c.name}`}>
            <div><code>{c.name}</code><p>{c.line}</p></div>
            <div className="score" aria-label={`Without the skill ${c.without} of 3 runs passed, with it 3 of 3`}>
              <Ticks filled={asTicks(c.without)} total={TOTAL} />
              <span className="lab dim"><span>Without</span><span>{c.without}/3</span></span>
              <Ticks filled={TOTAL} total={TOTAL} />
              <span className="lab"><span>With skills</span><span>3/3</span></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
