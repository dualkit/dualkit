import Link from 'next/link'
import { Ar, Frame, Label } from '@/components/v3/primitives'
import { CAREERS as C, ROLES } from '@/lib/careers'
import { CareersShell, Headline, at, wordCount } from './Shell'

const ARROW = <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" /></svg>

/** /careers: the pitch and one ruled row per open role. Each row opens the role's own page. */
export async function CareersPage() {
  const n = wordCount(C.headline)
  return (
    <CareersShell>
      <section className="v3-wrap" aria-labelledby="cr-title">
        <div className="v3-hero-head">
          <Headline id="cr-title" label={C.label} lines={C.headline} />
          <div className="v3-hero-side">
            <p className="v3-lede v3-hero-in" style={at(n + 1)}>{C.lede}</p>
          </div>
        </div>
      </section>

      <section className="v3-sec cr-last" aria-labelledby="cr-roles">
        <div className="v3-wrap">
          <div className="v3-sec-title">
            <Label>{C.listLabel}</Label>
            <h2 id="cr-roles" className="v3-h2">{C.listHeading}</h2>
          </div>
          <Frame className="v3-sec-body cr-roles">
            <ul className="cr-role-list">
              {ROLES.map((role) => (
                <li key={role.slug}>
                  <Link className="cr-role" href={`/careers/${role.slug}`}>
                    <span className="cr-role-main">
                      <span className="cr-role-title">
                        <span className="v3-step">{role.title}</span>
                        {role.titleAr ? <Ar><span className="cr-role-ar">{role.titleAr}</span></Ar> : null}
                      </span>
                      <span className="v3-body cr-role-summary">{role.summary}</span>
                    </span>
                    <span className="cr-role-meta">
                      {role.meta.map((m) => <span key={m} className="cr-chip">{m}</span>)}
                    </span>
                    <span className="cr-role-go">{C.open}{ARROW}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Frame>
        </div>
      </section>
    </CareersShell>
  )
}
