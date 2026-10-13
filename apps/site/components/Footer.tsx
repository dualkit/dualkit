import Link from 'next/link'
import { compactCount } from '@/lib/counters'
import { COPY } from '@/lib/copy'
import { OVERALL_LABEL, type Overall } from '@/lib/status'
import { Mark } from './icons'
import { Mascot } from './Mascot'
import { Wordmark } from './Wordmark'

const isExternal = (href: string) => href.startsWith('http')

/** Hairline columns, a ruler, and the wordmark. Status comes from the /status checks, downloads from npm. */
export function Footer({ status, downloads }: { status: Overall; downloads: number | null }) {
  const f = COPY.footer
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="f-grid">
          <div>
            <span className="brand"><Mark />Dualkit</span>
            <Link className={`status status-${status}`} href="/status"><span className="dot" aria-hidden="true" />{OVERALL_LABEL[status]}</Link>
            {downloads !== null && downloads > 0 && <span className="small soft mono">{compactCount(downloads)} npm downloads last week</span>}
          </div>
          {f.columns.map(([title, links]) => (
            <div key={title}>
              <span className="t">{title}</span>
              {links.map(([label, href]) => isExternal(href) ? <a key={label} href={href}>{label}</a> : <Link key={label} href={href}>{label}</Link>)}
            </div>
          ))}
          <div className="maker">
            <Mascot />
            <span className="credit">{f.maker.label} <a href={f.maker.href}>{f.maker.name}</a></span>
          </div>
        </div>
        <div className="f-ruler" aria-hidden="true">{Array.from({ length: 49 }, (_, k) => <i key={k} />)}</div>
      </div>
      <Wordmark />
      <div className="wrap f-bottom"><span>{f.legal}</span><span>{f.tagline}</span></div>
    </footer>
  )
}
