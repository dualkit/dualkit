import type { CSSProperties, ReactNode } from 'react'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { NumbersGrid } from '@/components/v3/NumbersGrid'
import { CopyLine } from '@/components/v3/ProductsMenu'
import { Button, Frame, Label } from '@/components/v3/primitives'
import { CONVERT_COMMAND } from '@/lib/copy'
import { CONVERT_COPY as C } from '@/lib/convert-copy'
import { PROOF_APP, PROOF_COUNTS, PROOF_SCREENS } from '@/lib/convert-proof'
import { liveData } from '@/lib/live'
import { V3 } from '@/lib/v3/copy'
import { Diff } from './Diff'
import { Ledger } from './Ledger'
import { Run } from './Run'
import { Wipe } from './Wipe'
import '@/components/v3/hero.css'
import '@/components/v3/sec.css'
import '@/components/v3/numbers.css'
import './convert.css'

const FINISH_COMMAND = 'npx dualkit@beta convert --finish'
const STEP_COMMANDS = [CONVERT_COMMAND, V3.menu.command, FINISH_COMMAND]
const THIRDS = ['calc(100% / 3)', 'calc(100% * 2 / 3)']
const at = (n: number) => ({ '--i': n }) as CSSProperties
const lines = (text: string) => text.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)

/** A section head as the home page draws it: label and heading on the left, the lede on the right. */
function Head({ id, label, heading, lede }: { id: string; label: string; heading: string; lede?: ReactNode }) {
  return (
    <div className="v3-sec-head">
      <div className="v3-sec-title">
        <Label>{label}</Label>
        <h2 id={id} className="v3-h2">{lines(heading)}</h2>
      </div>
      {lede ? <div className="v3-sec-side"><p className="v3-lede">{lede}</p></div> : null}
    </div>
  )
}

function Hero() {
  const H = C.hero
  const words = H.headline.flatMap((line, l) => line.split(' ').map((word, k) => ({ word, l, first: k === 0 })))
  return (
    <section className="v3-wrap" aria-labelledby="cv-title">
      <div className="v3-hero-head">
        <div className="v3-hero-title">
          <div className="v3-hero-in" style={at(words.length)}><Label>{H.label}</Label></div>
          <h1 id="cv-title" className="v3-display" aria-label={H.headline.join(' ')}>
            {words.map(({ word, l, first }, n) => (
              <span key={n}>{first && l ? <br /> : n ? ' ' : null}<span className="v3-hero-w v3-hero-in" style={at(n)}>{word}</span></span>
            ))}
          </h1>
        </div>
        <div className="v3-hero-side">
          <p className="v3-lede v3-hero-in" style={at(words.length + 1)}>{H.lede}</p>
          <div className="v3-hero-actions v3-hero-in" style={at(words.length + 2)}>
            <Button href="/docs#convert" kind="ink" arrow>{H.primary}</Button>
            <Button href={PROOF_APP.diff} kind="outline">{H.secondary}</Button>
          </div>
        </div>
      </div>
      <Frame className="cv-hero-frame">
        <Wipe screens={PROOF_SCREENS} />
      </Frame>
    </section>
  )
}

/** The /convert page: TailAdmin, a real open-source app, converted and shown from every side. */
export async function ConvertPage() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="v3 cv">
        <Hero />

        <section className="v3-sec" aria-labelledby="cv-run">
          <div className="v3-wrap">
            <Head id="cv-run" label={C.run.label} heading={C.run.heading} lede={C.run.lede} />
            <Frame className="v3-sec-body cv-run-frame" joins={['58%']}><Run /></Frame>
          </div>
        </section>

        <section className="v3-sec" aria-labelledby="cv-diff">
          <div className="v3-wrap">
            <Head id="cv-diff" label={C.diff.label} heading={C.diff.heading} lede={C.diff.lede} />
            <Frame className="v3-sec-body cv-diff-frame" joins={[400]}><Diff /></Frame>
          </div>
        </section>

        <section className="v3-sec" aria-labelledby="cv-ledger">
          <div className="v3-wrap">
            <Head id="cv-ledger" label={C.ledger.label} heading={C.ledger.heading} lede={C.ledger.lede} />
            <Frame className="v3-sec-body cv-ledger-frame"><Ledger /></Frame>
          </div>
        </section>

        <section className="v3-sec" aria-labelledby="cv-numbers">
          <div className="v3-wrap">
            <Head id="cv-numbers" label={C.numbers.label} heading={C.numbers.heading} />
            <Frame className="v3-sec-body v3-num-frame" joins={['25%', '50%', '75%']}>
              <NumbersGrid stats={C.numbers.stats(PROOF_COUNTS)} />
            </Frame>
          </div>
        </section>

        <section className="v3-sec" aria-labelledby="cv-steps">
          <div className="v3-wrap">
            <Head id="cv-steps" label={C.steps.label} heading={C.steps.heading} />
            <Frame className="v3-sec-body cv-steps" joins={THIRDS}>
              {C.steps.items.map(([no, title, body], k) => (
                <article key={no} className="cv-step">
                  <span className="cv-step-no">{no}</span>
                  <h3 className="v3-step">{title}</h3>
                  <p className="v3-body cv-step-body">{body}</p>
                  <CopyLine command={STEP_COMMANDS[k]!} />
                </article>
              ))}
            </Frame>
          </div>
        </section>

        <section className="v3-sec cv-last" aria-labelledby="cv-left">
          <div className="v3-wrap">
            <Head id="cv-left" label={C.left.label} heading={C.left.heading} lede={C.left.lede} />
            <Frame className="v3-sec-body cv-left" joins={['50%']}>
              {C.left.items.map(([title, body], k) => (
                <div key={title} className="cv-left-item">
                  <span className="v3-small cv-left-no">{`0${k + 1}`}</span>
                  <h3 className="v3-step">{title}</h3>
                  <p className="v3-body cv-left-body">{body}</p>
                </div>
              ))}
            </Frame>
            <p className="v3-small cv-credit">
              <a href={PROOF_APP.source} rel="noopener noreferrer">{PROOF_APP.name}</a>{C.credit.after}
              <a href={PROOF_APP.branch} rel="noopener noreferrer">{C.credit.branch}</a>.
            </p>
          </div>
        </section>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}
