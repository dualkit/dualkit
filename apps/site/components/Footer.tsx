import Link from 'next/link'
import { compactCount } from '@/lib/counters'
import { COPY } from '@/lib/copy'
import { OVERALL_LABEL, type Overall } from '@/lib/status'
import { Mark } from './icons'
import { Wordmark } from './Wordmark'

const isExternal = (href: string) => href.startsWith('http')

/** Status and downloads are real: the status comes from /status checks, downloads from the npm API. */
export function Footer({ status, downloads }: { status: Overall; downloads: number | null }) {
  const f = COPY.footer
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="f-grid">
          <div className="f-brand">
            <span className="brand"><Mark light="var(--mark-on-panel)" />Dualkit</span>
            <span className="secondary">{f.tagline}</span>
            <Link className={`status status-${status}`} href="/status"><span className="dot" aria-hidden="true" />{OVERALL_LABEL[status]}</Link>
            {downloads !== null && downloads > 0 && <span className="cap mono">{compactCount(downloads)} npm downloads last week</span>}
          </div>
          {f.columns.map(([title, links]) => (
            <div className="f-col" key={title}>
              <span className="t">{title}</span>
              {links.map(([label, href]) => isExternal(href)
                ? <a key={label} href={href}>{label}</a>
                : <Link key={label} href={href}>{label}</Link>)}
            </div>
          ))}
        </div>
        <div className="f-bottom"><span>{f.legal}</span><span>{f.note}</span></div>
        <p className="wordmark-hint">{f.hint}</p>
      </div>
      <Wordmark />
    </footer>
  )
}
