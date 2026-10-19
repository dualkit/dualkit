'use client'
import { COPY } from '@/lib/copy'
import { useInView } from '@/lib/motion'

const Lights = () => <span className="lights" aria-hidden="true"><i /><i /><i /></span>

/** The real report in a window that runs off the panel. Its two evidence pins pulse in turn when it scrolls in; hover or focus one to read the finding. */
export function CheckReport() {
  const c = COPY.check
  const [ref, seen] = useInView<HTMLElement>(0.4)
  return (
    <figure ref={ref} className="ck-win reveal" data-seen={seen}>
      <div className="titlebar ck-bar"><Lights /><span className="t">{c.window}</span><span /></div>
      <div className="ck-view">
        <div className="ck-shot">
          <img src="/img/check-report.webp" width={1228} height={966} loading="lazy" decoding="async" alt={c.alt} />
          {c.pins.map((p, i) => (
            <button
              key={p.n}
              type="button"
              className={`ck-pin${p.end ? ' end' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ['--i' as string]: i }}
              aria-label={`Finding ${p.n}: ${p.title}`}
            >
              <span className="ck-tip" aria-hidden="true"><span>{p.title}</span><code>{p.rule}</code></span>
            </button>
          ))}
        </div>
      </div>
    </figure>
  )
}
