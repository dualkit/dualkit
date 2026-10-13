import Link from 'next/link'
import { COPY, REPO_URL } from '@/lib/copy'
import { StarIcon } from './icons'

export function Hero() {
  const h = COPY.hero
  return (
    <header className="hero">
      <h1 className="h-hero">
        <span className="rise" style={{ display: 'block', animationDelay: '300ms' }}>{h.headline[0]}</span>
        <span className="rise" style={{ display: 'block', animationDelay: '400ms' }}>{h.headline[1]}</span>
      </h1>
      <div className="hero-row rise" style={{ animationDelay: '600ms' }}>
        <p className="lede">{h.lede}</p>
        <div className="actions">
          <Link className="pill primary" href="/docs">{h.primary}</Link>
          <a className="pill" href={REPO_URL}><StarIcon className="star" />{h.secondary}</a>
        </div>
      </div>
    </header>
  )
}
