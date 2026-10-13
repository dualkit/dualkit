import Link from 'next/link'
import { COPY } from '@/lib/copy'

export function Closing() {
  const c = COPY.closing
  return (
    <section className="closing reveal">
      <h2 className="h2">{c.heading}</h2>
      <div className="actions"><Link className="pill primary" href="/docs">{c.primary}</Link><Link className="pill" href="/docs">{c.secondary}</Link></div>
    </section>
  )
}
