import { Ar, Button, Frame } from '@/components/v3/primitives'
import { CAREERS as C, type Role } from '@/lib/careers'
import { BackLink, CareersShell, Headline, at, wordCount } from './Shell'

/** One role: what it is, what the work looks like, who fits. The form lives on its own page. */
export async function RolePage({ role }: { role: Role }) {
  const R = C.role
  const lines = [role.title]
  const n = wordCount(lines)
  const apply = `/careers/${role.slug}/apply`
  return (
    <CareersShell>
      <section className="v3-wrap" aria-labelledby="cr-title">
        <div className="cr-crumb"><BackLink href="/careers">{R.back}</BackLink></div>
        <div className="v3-hero-head cr-role-head">
          <Headline
            id="cr-title"
            label={C.label}
            lines={lines}
            after={role.titleAr ? <Ar as="p"><span className="cr-title-ar v3-hero-in" style={at(n)}>{role.titleAr}</span></Ar> : null}
          />
          <div className="v3-hero-side">
            <p className="v3-lede v3-hero-in" style={at(n + 1)}>{role.summary}</p>
            <div className="cr-role-meta v3-hero-in" style={at(n + 2)}>
              {role.meta.map((m) => <span key={m} className="cr-chip">{m}</span>)}
            </div>
            <div className="v3-hero-actions v3-hero-in" style={at(n + 3)}>
              <Button href={apply} kind="ink" arrow>{R.apply}</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="v3-wrap cr-detail" aria-label={role.title}>
        <Frame className="cr-doc">
          <div className="cr-doc-row">
            <h2 className="v3-step">About the role</h2>
            <div className="cr-doc-body">
              {role.intro.map((p) => <p key={p} className="v3-body">{p}</p>)}
            </div>
          </div>
          {role.sections.map((s) => (
            <div key={s.heading} className="cr-doc-row">
              <h2 className="v3-step">{s.heading}</h2>
              <ul className="cr-doc-list">
                {s.items.map((item) => <li key={item} className="v3-body">{item}</li>)}
              </ul>
            </div>
          ))}
        </Frame>
      </section>

      <section className="v3-sec cr-last" aria-labelledby="cr-close">
        <div className="v3-wrap">
          <div className="v3-sec-head">
            <h2 id="cr-close" className="v3-h2">{R.closingHeading}</h2>
            <div className="v3-sec-side">
              <p className="v3-lede">{R.closingLede}</p>
              <Button href={apply} kind="ink" arrow>{R.apply}</Button>
            </div>
          </div>
        </div>
      </section>
    </CareersShell>
  )
}
