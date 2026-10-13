import Link from 'next/link'
import { compactCount } from '@/lib/counters'
import { COPY } from '@/lib/copy'
import { Mark, StarIcon } from './icons'

/** Translucent nav. The star count is GitHub's real number, shown only once it exists. */
export function Nav({ stars }: { stars: number | null }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="wrap">
        <Link className="brand" href="/"><Mark />Dualkit</Link>
        <div className="links">
          {COPY.nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </div>
        <div className="nav-end">
          <a className="ghost-btn" href="https://github.com/dualkit/dualkit">
            <StarIcon className="star" />{COPY.github}
            {stars !== null && stars > 0 && <span className="count mono">{compactCount(stars)}</span>}
          </a>
        </div>
      </div>
    </nav>
  )
}
