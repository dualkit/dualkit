import { ACTION_URL, CHECK_COMMAND, COPY } from '@/lib/copy'
import { CheckReport } from './CheckReport'
import { CopyCommand } from './CopyCommand'

export function CheckSection() {
  const c = COPY.check
  return (
    <section id="check" className="section">
      <div className="ck-panel">
        <div className="ck-copy">
          <div className="ck-text">
            <h2 className="h2">{c.heading[0]}<br />{c.heading[1]}</h2>
            <p className="lede">{c.lede}</p>
          </div>
          <div className="ck-run">
            <CopyCommand command={CHECK_COMMAND} />
            <p className="small soft">{c.action} <a className="ck-link" href={ACTION_URL}>{c.actionLink}</a>.</p>
          </div>
        </div>
        <CheckReport />
      </div>
    </section>
  )
}
