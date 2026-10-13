import { COPY } from '@/lib/copy'
import { EvalCard } from './EvalCard'
import { ArrowIcon } from './icons'
import { Typer } from './Typer'

export function Skills() {
  const s = COPY.skills
  return (
    <section id="skills" className="split">
      <div>
        <div className="eyebrow">Skills</div>
        <h2>{s.heading[0]}<br />{s.heading[1]}</h2>
        <p className="sec-lede">{s.lede}</p>
        <Typer words={s.list.map(([name]) => name)} />
        <div className="skill-list">
          {s.list.map(([name, line]) => (
            <a className="skill" key={name} href={`https://github.com/dualkit/dualkit/tree/main/skills/${name}`}>
              <span className="n">{name}</span><span className="d">{line}</span><ArrowIcon className="go" />
            </a>
          ))}
        </div>
      </div>
      <EvalCard />
    </section>
  )
}
