import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { CheckIcon, RssIcon, StarIcon } from '@/components/icons'
import { Nav } from '@/components/Nav'
import { Reveal } from '@/components/Reveal'
import { liveData } from '@/lib/live'
import { RELEASES, UP_NEXT, displayDate, progress } from '@/lib/updates'

export const metadata: Metadata = { title: 'Updates', description: 'Every Dualkit release, newest first.' }
export const revalidate = 300

export default async function Updates() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap page">
        <header className="page-head">
          <h1 className="rise">Updates</h1>
          <div className="page-head-row rise" style={{ animationDelay: '120ms' }}>
            <p className="lede">Every Dualkit release, newest first.</p>
            <div className="actions">
              <a className="pill" href="/updates/rss.xml"><RssIcon />RSS</a>
              <a className="pill" href="https://github.com/dualkit/dualkit/releases"><StarIcon className="star" />Watch on GitHub</a>
            </div>
          </div>
        </header>
        {RELEASES.map((r) => (
          <article className="entry" id={r.slug} key={r.slug}>
            <div className="entry-rail"><span className="entry-date">{displayDate(r.date)}</span><span className="tag">{r.version}</span></div>
            <div className="entry-body">
              <div className="entry-tags">{r.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
              <h2 className="h2">{r.title}</h2>
              {r.body.map((p) => <p className="lede" key={p}>{p}</p>)}
              <div className="card shipped">
                <span className="small soft" style={{ padding: '4px 4px 0' }}>Shipped</span>
                <ul>{r.shipped.map((s) => <li key={s.name}><CheckIcon className="ok-ico" /><div><span className="mono">{s.name}</span><span className="small soft">{s.line}</span></div></li>)}</ul>
              </div>
            </div>
          </article>
        ))}
        <section className="entry next">
          <div className="entry-rail"><span className="entry-date">Up next</span></div>
          <div className="next-cards">
            {UP_NEXT.map((n) => {
              const p = progress(n)
              return (
                <div className="card" key={n.title}>
                  <div className="card-head"><h3>{n.title}</h3><span className="tag">{n.state}</span></div>
                  <p className="soft">{n.line}</p>
                  <div className="meter" role="progressbar" aria-label={`${n.title} progress`} aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
                    <span className="figure-sm">{p.percent}%</span>
                    <div className="meter-track"><span style={{ width: `${p.percent}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
      <Reveal />
    </>
  )
}
