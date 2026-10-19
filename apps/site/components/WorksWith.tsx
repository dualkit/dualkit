import { COPY } from '@/lib/copy'
import { WORKS_WITH } from '@/lib/marks'

export function WorksWith() {
  return (
    <section className="works" aria-label={COPY.worksWith.label}>
      <p className="soft">{COPY.worksWith.line} {COPY.worksWith.listed}</p>
      <ul className="works-row">
        {WORKS_WITH.map((tool) => (
          <li key={tool.name}>
            <a href={tool.href}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={tool.path} /></svg>
              {tool.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
