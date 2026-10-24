import { CopyCommand } from '@/components/CopyCommand'
import { ArrowIcon } from '@/components/icons'
import { Reveal } from '@/components/Reveal'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { CONVERT_COMMAND } from '@/lib/copy'
import { CONVERT_COPY as C } from '@/lib/convert-copy'
import { PROOF_APP, PROOF_COUNTS, PROOF_SCREENS } from '@/lib/convert-proof'
import { liveData } from '@/lib/live'
import { Viewer } from './Viewer'
import './convert.css'

const FINISH_COMMAND = 'npx dualkit@beta convert --finish'

function Steps() {
  const commands = [CONVERT_COMMAND, null, FINISH_COMMAND]
  return (
    <section className="cv-steps" aria-labelledby="cv-steps">
      <h2 className="h2 reveal" id="cv-steps">{C.steps.heading}</h2>
      <ol className="cv-step-list">
        {C.steps.items.map(([title, body], i) => (
          <li className="cv-step reveal" key={title}>
            <span className="cv-step-n" aria-hidden="true">{i + 1}</span>
            <div className="cv-step-body">
              <h3>{title}</h3>
              <p className="soft">{body}</p>
              {commands[i] && <CopyCommand command={commands[i]!} />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The /convert page: a real open-source app, before and after. */
export async function ConvertPage() {
  const live = await liveData()
  const counts = C.counts(PROOF_COUNTS)
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap cv">
        <header className="hero cv-hero">
          <h1 className="h-hero rise">{C.headline[0]}<br />{C.headline[1]}</h1>
          <div className="cv-hero-row rise" style={{ animationDelay: '120ms' }}>
            <p className="lede">{C.lede}</p>
            <div className="actions">
              <a className="pill primary" href={PROOF_APP.diff}>{C.diff}</a>
              <a className="pill" href="/docs#convert"><ArrowIcon />{C.docs}</a>
            </div>
          </div>
        </header>

        <section className="cv-proof rise" style={{ animationDelay: '220ms' }} aria-label={C.viewerLabel}>
          <Viewer screens={PROOF_SCREENS} />
          <p className="small soft cv-caption">{C.caption(PROOF_COUNTS.worstEnglishDiff)}</p>
        </section>

        <section className="cv-counts" aria-label={C.countsLabel}>
          {counts.map(([n, label]) => (
            <div className="cv-count reveal" key={label}><span className="cv-count-n">{n}</span><span className="soft">{label}</span></div>
          ))}
        </section>

        <Steps />

        <section className="cv-left" aria-labelledby="cv-left">
          <div className="cv-left-side">
            <h2 className="h2 reveal" id="cv-left">{C.left.heading}</h2>
            <p className="lede reveal">{C.left.lede}</p>
          </div>
          <ul className="cv-left-list">
            {C.left.items.map(([title, body]) => (
              <li className="reveal" key={title}><h3>{title}</h3><p className="soft">{body}</p></li>
            ))}
          </ul>
        </section>

        <section className="cv-credit small soft">
          <p>{C.credit.before}<a href={PROOF_APP.source}>{PROOF_APP.name}</a>{C.credit.after}<a href={PROOF_APP.branch}>{C.credit.branch}</a>.</p>
        </section>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
      <Reveal />
    </>
  )
}
