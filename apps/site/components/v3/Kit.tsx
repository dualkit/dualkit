import { V3 } from '@/lib/v3/copy'
import { KitAccordion, type KitItem } from './KitAccordion'
import { Label } from './primitives'
import { BenchPreview } from './previews/Bench'
import { CheckPreview } from './previews/Check'
import { ConvertPreview } from './previews/Convert'
import { FormatPreview } from './previews/Format'
import { SkillsDiffPreview } from './previews/SkillsDiff'
import { StarterPreview } from './previews/Starter'
import './kit.css'

const K = V3.kit
const PREVIEWS = [<SkillsDiffPreview key="s" />, <FormatPreview key="f" />, <StarterPreview key="t" />, <CheckPreview key="c" />, <ConvertPreview key="v" />, <BenchPreview key="b" />]

const PART_LINES = new Map<string, string>(V3.menu.parts.map(([, name, line]) => [name, line]))

/** Names and details come from the copy: the open Skills item has its own title, body and points; the others use the Products menu line. */
const ITEMS: readonly KitItem[] = [K.open.name, ...K.rest].map((name, k) => ({
  name,
  no: `0${k + 1}`,
  title: k === 0 ? K.open.title : null,
  body: k === 0 ? K.open.body : PART_LINES.get(name) ?? '',
  points: k === 0 ? K.open.points : [],
}))

/** The kit: a one-open accordion of the six parts on the left, the open part's glass preview on the dusk painting on the right. */
export function Kit() {
  return (
    <section className="v3-kit" aria-labelledby="v3-kit-title">
      <div className="v3-wrap">
        <div className="v3-kit-head">
          <div className="v3-kit-heading">
            <Label>{K.label}</Label>
            <h2 id="v3-kit-title" className="v3-h2">{K.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
          </div>
          <p className="v3-lede v3-kit-lede">{K.lede}</p>
        </div>
        <KitAccordion items={ITEMS} previews={PREVIEWS} />
      </div>
    </section>
  )
}
