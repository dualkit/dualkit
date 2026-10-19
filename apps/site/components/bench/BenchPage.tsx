import { RULES } from '@dualkit/rules'
import { Footer } from '@/components/Footer'
import { ArrowIcon } from '@/components/icons'
import { Nav } from '@/components/Nav'
import { Reveal } from '@/components/Reveal'
import type { BenchMonth } from '@/lib/bench-schema'
import { BENCH_COPY } from '@/lib/bench-copy'
import { lastRunLabel, nextRunAt, runDayLabel } from '@/lib/bench-live'
import { benchOutOf, factsLine, factsOf } from '@/lib/bench-view'
import { liveData } from '@/lib/live'
import { BenchStatus } from './BenchStatus'
import { Board } from './Board'
import { MonthPicker } from './MonthPicker'

const C = BENCH_COPY
const RULE_COUNT = RULES.length
/** Rule fixes for the evidence lists, from @dualkit/rules. Plain strings, so the rule code stays on the server. */
const FIXES: Record<string, string> = Object.fromEntries(RULES.map((r) => [r.id, r.fix]))

function Hero({ month, months, facts }: { month: string; months: readonly string[]; facts: string | null }) {
  return (
    <header className="hero bx-hero">
      <h1 className="h-hero rise">{C.headline[0]}<br />{C.headline[1]}</h1>
      <div className="hero-row rise" style={{ animationDelay: '120ms' }}>
        <p className="lede">{C.lede(RULE_COUNT)}</p>
        <div className="bx-meta">
          <MonthPicker month={month} months={months} />
          {facts && <span className="small soft">{facts}</span>}
        </div>
      </div>
    </header>
  )
}

function Legend({ outOf }: { outOf: number }) {
  return (
    <div className="bx-legend small">
      <span className="bx-key"><i className="bx-key-ring" aria-hidden="true" /><span className="soft">{C.legend.alone}</span></span>
      <span className="bx-key"><i className="bx-key-dot" aria-hidden="true" /><span className="soft">{C.legend.dualkit}</span></span>
      <span className="faint">{C.legend.caption(outOf)}</span>
    </div>
  )
}

function How() {
  return (
    <section className="bx-how" aria-labelledby="bx-how">
      <div className="bx-how-side">
        <h2 className="h2 bx-h2" id="bx-how">{C.how.heading}</h2>
        <div className="actions">
          <a className="pill" href={C.promptsUrl}>{C.prompts}</a>
          <a className="pill" href={C.rawUrl}><ArrowIcon />{C.raw}</a>
        </div>
      </div>
      <div className="bx-how-items">
        {C.how.items(RULE_COUNT).map(([title, body]) => (
          <div className="bx-how-item reveal" key={title}><h3 className="bx-label">{title}</h3><p className="soft">{body}</p></div>
        ))}
      </div>
    </section>
  )
}

function Empty({ day }: { day: string }) {
  return (
    <section className="bx-empty">
      <h2 className="h2 bx-h2">{C.empty.heading(day)}</h2>
      <p className="lede">{C.empty.lede}</p>
      <a className="pill" href={C.promptsUrl}>{C.prompts}</a>
    </section>
  )
}

/**
 * The /bench page for one month, or the empty state before the first run.
 * `latest` is the newest month, which the status line's last run comes from.
 */
export async function BenchPage({ data, latest, months, planned }: { data: BenchMonth | null; latest: BenchMonth | null; months: readonly string[]; planned: { models: number; screens: number } | null }) {
  const live = await liveData()
  const next = nextRunAt(new Date())
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap bx">
        {data ? (
          <>
            <Hero month={data.month} months={months} facts={factsLine(factsOf(data))} />
            <section className="bx-board-band" aria-label="Leaderboard">
              <BenchStatus lastRun={latest ? lastRunLabel(latest.generatedAt) : null} ruleCount={RULE_COUNT} />
              <Legend outOf={benchOutOf(data)} />
              <Board models={data.models} ruleCount={data.ruleCount} fixes={FIXES} outOf={benchOutOf(data)} />
            </section>
          </>
        ) : (
          <>
            <Hero month={next.toISOString().slice(0, 7)} months={[]} facts={planned && factsLine(planned)} />
            <section className="bx-board-band bx-empty-band" aria-label="Next run">
              <BenchStatus lastRun={null} ruleCount={RULE_COUNT} />
              <Empty day={runDayLabel(next)} />
            </section>
          </>
        )}
        <How />
      </main>
      <Footer status={live.status} downloads={live.downloads} />
      <Reveal />
    </>
  )
}

export const benchDescription = C.lede(RULE_COUNT)
export const benchTitle = C.title
