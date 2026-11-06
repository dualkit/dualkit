import type { Metadata } from 'next'
import { CopyCommand } from '@/components/CopyCommand'
import { GulfDemo } from '@/components/gulf/GulfDemos'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { GULF_COPY as C, GULF_SLUGS, gulfInstall } from '@/lib/gulf-copy'
import { liveData } from '@/lib/live'
import '@/components/gulf/gulf.css'

export const metadata: Metadata = { title: C.title, description: C.description }
export const revalidate = 300

export default async function GulfComponents() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="wrap page docs">
        <header className="page-head">
          <h1 className="rise">{C.heading}</h1>
          <p className="lede">{C.lede}</p>
          <p className="soft">{C.setup}</p>
          <p className="small soft">{C.contract}</p>
        </header>
        {GULF_SLUGS.map((slug) => (
          <section className="doc-block" id={slug} key={slug} aria-labelledby={`${slug}-title`}>
            <h2 className="h2" id={`${slug}-title`}>{C.items[slug].name}</h2>
            <p className="soft">{C.items[slug].line}</p>
            <CopyCommand command={gulfInstall(slug)} />
            <GulfDemo slug={slug} />
          </section>
        ))}
      </main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}
