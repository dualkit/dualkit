import { CheckSection } from '@/components/CheckSection'
import { Closing } from '@/components/Closing'
import { Footer } from '@/components/Footer'
import { FormatSection } from '@/components/FormatSection'
import { Hero } from '@/components/Hero'
import { MirrorSection } from '@/components/MirrorSection'
import { Nav } from '@/components/Nav'
import { Reveal } from '@/components/Reveal'
import { SkillsSection } from '@/components/SkillsSection'
import { Stage } from '@/components/Stage'
import { StarterSection } from '@/components/StarterSection'
import { Strip } from '@/components/Strip'
import { WorksWith } from '@/components/WorksWith'
import { liveData } from '@/lib/live'

export const revalidate = 300

export default async function Home() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main id="top" className="wrap">
        <Hero />
        <Stage />
        <WorksWith />
        <SkillsSection />
        <FormatSection />
        <StarterSection />
        <CheckSection />
        <MirrorSection />
        <Strip />
        <Closing />
      </main>
      <Footer status={live.status} downloads={live.downloads} />
      <Reveal />
    </>
  )
}
