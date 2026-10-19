import { BenchTeaser } from '@/components/v3/BenchTeaser'
import { Closing } from '@/components/v3/Closing'
import { Footer } from '@/components/v3/Footer'
import { GulfMap } from '@/components/v3/GulfMap'
import { Hero } from '@/components/v3/Hero'
import { HowItWorks } from '@/components/v3/HowItWorks'
import { Kit } from '@/components/v3/Kit'
import { Mirror } from '@/components/v3/Mirror'
import { Nav } from '@/components/v3/Nav'
import { Numbers } from '@/components/v3/Numbers'
import { RegionVideo } from '@/components/v3/RegionVideo'
import { Statement } from '@/components/v3/Statement'
import { WorksWith } from '@/components/v3/WorksWith'
import { liveData } from '@/lib/live'

export const revalidate = 300

export default async function Home() {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main id="top" className="v3">
        <div className="v3-wrap"><Hero /></div>
        <Statement />
        <HowItWorks />
        <GulfMap />
        <Kit />
        <WorksWith />
        <RegionVideo />
        <Mirror />
        <BenchTeaser />
        <Numbers />
        <Closing />
      </main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}
