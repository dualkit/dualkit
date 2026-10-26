import { Frame } from '@/components/v3/primitives'
import { CAREERS as C, type Role } from '@/lib/careers'
import { ApplyForm } from './ApplyForm'
import { BackLink, CareersShell, Headline, at } from './Shell'

/** The short application form for one role, on a page of its own. */
export async function ApplyPage({ role }: { role: Role }) {
  const F = C.form
  const lines = [`${role.title}.`]
  const n = lines[0]!.split(' ').length
  return (
    <CareersShell>
      <section className="v3-wrap cr-last" aria-labelledby="cr-title">
        <div className="cr-crumb"><BackLink href={`/careers/${role.slug}`}>{F.back}</BackLink></div>
        <div className="cr-apply">
          <div className="cr-apply-head">
            <Headline id="cr-title" label={F.label} lines={lines} />
            <p className="v3-lede v3-hero-in" style={at(n + 1)}>{F.lede}</p>
          </div>
          <div className="v3-hero-in" style={at(n + 2)}>
            <Frame className="cr-form-frame">
              <ApplyForm role={role.slug} linkHint={role.linkHint} />
            </Frame>
          </div>
        </div>
      </section>
    </CareersShell>
  )
}
