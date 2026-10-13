import Link from 'next/link'
import { COPY, SKILLS_COMMAND } from '@/lib/copy'
import { CopyCommand } from './CopyCommand'
import { ArrowIcon } from './icons'

export function Closing() {
  const c = COPY.closing
  return (
    <div className="closing">
      <div className="in reveal">
        <h2>{c.heading[0]}<br />{c.heading[1]}</h2>
        <p className="sec-lede">{c.lede}</p>
        <div className="actions"><CopyCommand command={SKILLS_COMMAND} /><Link className="primary" href="/docs">{COPY.hero.cta} <ArrowIcon /></Link></div>
      </div>
    </div>
  )
}
