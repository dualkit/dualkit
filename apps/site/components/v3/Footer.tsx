import Link from 'next/link'
import { Mark } from '@/components/icons'
import { Mascot } from '@/components/Mascot'
import { REPO_URL } from '@/lib/copy'
import { OVERALL_LABEL, type Overall } from '@/lib/status'
import { V3 } from '@/lib/v3/copy'
import { CLAUDE_URL, MAKER_URL, NPM_ORG_URL, footerColumns } from '@/lib/v3/footer'
import { Seals, markPath } from './Seals'
import './footer.css'

const F = V3.footer
const GITHUB = 'M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z'

const SOCIALS = [
  { label: 'GitHub', href: REPO_URL, d: GITHUB },
  { label: 'npm', href: NPM_ORG_URL, d: markPath('npm') },
  { label: 'Claude', href: CLAUDE_URL, d: markPath('Claude Code') },
]

const isExternal = (href: string) => href.startsWith('http')

function FooterLink({ href, children }: { href: string; children: string }) {
  return isExternal(href)
    ? <a href={href} rel="noopener noreferrer">{children}</a>
    : <Link href={href}>{children}</Link>
}

/** The grand footer: brand, link columns, seals, legal row, then the painting with the wordmark. Takes the status as a prop so any page can use it. */
export function Footer({ status }: { status: Overall }) {
  return (
    <footer className="v3-foot">
      <div className="v3-wrap">
        <div className="v3-foot-top">
          <div className="v3-foot-brand">
            <span className="v3-foot-logo"><Mark />Dualkit</span>
            <p className="v3-body v3-foot-line">{F.line}</p>
            <div className="v3-foot-socials">
              {SOCIALS.map((s) => {
                const icon = <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d={s.d} /></svg>
                return isExternal(s.href)
                  ? <a key={s.label} className="v3-foot-social" href={s.href} rel="noopener noreferrer" aria-label={s.label}>{icon}</a>
                  : <Link key={s.label} className="v3-foot-social" href={s.href} aria-label={s.label}>{icon}</Link>
              })}
            </div>
            <Link className={`v3-foot-status v3-foot-status--${status}`} href="/status"><span className="v3-foot-dot" aria-hidden="true" />{OVERALL_LABEL[status]}</Link>
          </div>
          <nav className="v3-foot-cols" aria-label="Footer">
            {footerColumns().map((col) => (
              <div key={col.title} className="v3-foot-col">
                <span className="v3-foot-title">{col.title}</span>
                {col.links.map((l) => l.href ? <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink> : <span key={l.label} className="v3-foot-plain">{l.label}</span>)}
              </div>
            ))}
          </nav>
        </div>
        <Seals />
        <hr className="v3-foot-rule" />
        <div className="v3-foot-legal">
          <span>{F.legal}</span>
          <span className="v3-foot-made">{F.madeBy} <a href={MAKER_URL} rel="noopener noreferrer">{F.maker}</a><span className="v3-foot-mascot"><Mascot /></span></span>
        </div>
      </div>
      <div className="v3-foot-art" data-painting="footer">
        <span className="v3-foot-word" aria-hidden="true">Dualkit</span>
      </div>
    </footer>
  )
}
