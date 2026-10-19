import type { Metadata } from 'next'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { liveData } from '@/lib/live'
import { OVERALL_LABEL } from '@/lib/status'

export const metadata: Metadata = { title: 'Status', description: 'Live checks for the Dualkit package, repository and skills.' }
export const revalidate = 300

export default async function Status() {
  const live = await liveData()
  const checked = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' })
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap page">
        <header className="page-head">
          <h1 className="rise">Status</h1>
          <p className={`status status-${live.status} status-big rise`} style={{ animationDelay: '120ms' }}><span className="dot" aria-hidden="true" />{OVERALL_LABEL[live.status]}</p>
          <p className="small soft">Checked {checked} Gulf time. Each check is a real request, repeated at most every five minutes.</p>
        </header>
        <div className="card checks">
          {live.checks.map((c) => (
            <div className="check" key={c.id}>
              <span className={`status status-${c.ok === null ? 'unknown' : c.ok ? 'normal' : 'down'}`}><span className="dot" aria-hidden="true" />{c.name}</span>
              <span className="small soft mono">{c.detail}</span>
              <span className="small soft mono ms">{c.ms} ms</span>
            </div>
          ))}
        </div>
      </main>
      <Footer status={live.status} />
    </>
  )
}
