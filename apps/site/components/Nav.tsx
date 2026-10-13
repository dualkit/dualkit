import Link from 'next/link'
import { compactCount } from '@/lib/counters'
import { COPY, REPO_URL } from '@/lib/copy'
import { Mark, StarIcon } from './icons'
import { NavMenu } from './NavMenu'

/** Translucent bar with the Product drawer. The star count is GitHub's real number, shown only once it exists. */
export function Nav({ stars }: { stars: number | null }) {
  const n = COPY.nav
  return (
    <nav className="nav" aria-label="Main">
      <div className="wrap nav-row">
        <Link className="brand" href="/"><Mark />Dualkit</Link>
        <NavMenu />
        <div className="nav-end">
          <a className="pill gh" href={REPO_URL}>
            <StarIcon className="star" />{n.github}
            {stars !== null && stars > 0 && <span className="count">{compactCount(stars)}</span>}
          </a>
          <Link className="pill primary" href="/docs">{n.cta}</Link>
        </div>
      </div>
    </nav>
  )
}
