import { Closing } from '@/components/Closing'
import { Footer } from '@/components/Footer'
import { FormatDemo } from '@/components/FormatDemo'
import { FormatTicker } from '@/components/FormatTicker'
import { Hero } from '@/components/Hero'
import { Nav } from '@/components/Nav'
import { Reveal } from '@/components/Reveal'
import { Skills } from '@/components/Skills'
import { Stage } from '@/components/Stage'
import { Starter } from '@/components/Starter'
import { Strip } from '@/components/Strip'
import { WorksWith } from '@/components/WorksWith'
import { CopyCommand } from '@/components/CopyCommand'
import { COPY, FORMAT_COMMAND } from '@/lib/copy'
import { liveData } from '@/lib/live'

export const revalidate = 300

export default async function Home() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main id="top">
        <div className="wrap"><Hero /></div>
        <WorksWith />
        <div className="wrap"><Stage caption={COPY.stageCaption} /></div>
        <FormatTicker />
        <div className="wrap">
          <Strip />
          <Skills />
          <section id="format" className="split center">
            <FormatDemo />
            <div>
              <div className="eyebrow">Format</div>
              <h2>{COPY.format.heading[0]}<br />{COPY.format.heading[1]}</h2>
              <p className="sec-lede">{COPY.format.lede}</p>
              <div style={{ marginTop: 32 }}><CopyCommand command={FORMAT_COMMAND} /></div>
            </div>
          </section>
          <Starter />
          <Closing />
        </div>
      </main>
      <Footer status={live.status} downloads={live.downloads} />
      <Reveal />
    </>
  )
}
