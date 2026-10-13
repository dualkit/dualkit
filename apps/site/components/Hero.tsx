import Link from 'next/link'
import { COPY } from '@/lib/copy'
import { HeroSlot } from './HeroSlot'
import { ArrowIcon } from './icons'
import { Install } from './Install'

export function Hero() {
  const h = COPY.hero
  return (
    <header className="hero">
      <span className="badge rise" style={{ animationDelay: '300ms' }}>{h.badge}</span>
      <h1>
        <span className="line rise" style={{ animationDelay: '400ms' }}>{h.line1}</span>
        <span className="line rise" style={{ animationDelay: '500ms' }}>In both <HeroSlot /> directions.</span>
      </h1>
      <p className="lede rise" style={{ animationDelay: '700ms' }}>{h.lede}</p>
      <div className="rise" style={{ animationDelay: '850ms' }}>
        <Install>
          <Link className="primary" href="/docs">{h.cta} <ArrowIcon /></Link>
        </Install>
      </div>
    </header>
  )
}
