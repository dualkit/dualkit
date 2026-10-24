import { latestBenchMonth, plannedBench } from '@/lib/bench'
import { compactCount } from '@/lib/counters'
import { CHECK_COMMAND, CONVERT_COMMAND, FORMAT_COMMAND, REPO_URL, STARTER_COMMAND } from '@/lib/copy'
import { RELEASES, displayDate } from '@/lib/updates'
import { V3 } from '@/lib/v3/copy'
import { daysUntil, nextBenchRun } from '@/lib/v3/menu'
import { BenchPreview } from './previews/Bench'
import { CheckPreview } from './previews/Check'
import { ConvertPreview } from './previews/Convert'
import { FormatPreview } from './previews/Format'
import { SkillsPreview } from './previews/Skills'
import { StarterPreview } from './previews/Starter'
import { Button } from './primitives'
import { ProductsMenu, type MenuPart } from './ProductsMenu'

/** In the order of V3.menu.parts. */
const PARTS: readonly MenuPart[] = [
  { href: '/docs#skills', command: V3.menu.command, docs: V3.menu.skills.docs, note: V3.menu.skills.note },
  { href: '/docs#format', command: FORMAT_COMMAND, docs: 'Open the Format docs', note: null },
  { href: '/docs#starter', command: STARTER_COMMAND, docs: 'Open the Starter docs', note: null },
  { href: '/docs#check', command: CHECK_COMMAND, docs: 'Open the Check docs', note: null },
  { href: '/convert', command: CONVERT_COMMAND, docs: 'See a real app converted', note: null },
  { href: '/bench', command: null, docs: V3.bench.action, note: null },
]

/** The Bench line shows only while there is a Bench to run: a published month or the package that runs it. */
function benchDays(now: Date): number | null {
  return latestBenchMonth() || plannedBench() ? daysUntil(nextBenchRun(now), now) : null
}

/** The v3 bar with the Products menu. The star count is GitHub's real number, shown only once it is above zero. */
export function Nav({ stars }: { stars: number | null }) {
  const latest = RELEASES[0]
  const n = V3.nav
  const end = (
    <>
      <span className="v3-nav-gh">
        <Button href={REPO_URL} kind="outline">{n.github}{stars !== null && stars > 0 ? <span className="v3-nav-count">{compactCount(stars)}</span> : null}</Button>
      </span>
      <Button href="/docs" kind="ink">{n.cta}</Button>
    </>
  )
  return (
    <ProductsMenu
      parts={PARTS}
      previews={[<SkillsPreview key="skills" />, <FormatPreview key="format" />, <StarterPreview key="starter" />, <CheckPreview key="check" />, <ConvertPreview key="convert" />, <BenchPreview key="bench" />]}
      latest={latest ? { title: latest.title, date: displayDate(latest.date), href: `/updates#${latest.slug}` } : null}
      benchDays={benchDays(new Date())}
      end={end}
    />
  )
}
