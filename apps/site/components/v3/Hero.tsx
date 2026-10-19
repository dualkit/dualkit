import type { CSSProperties } from 'react'
import { preload } from 'react-dom'
import { REPO_URL } from '@/lib/copy'
import { V3 } from '@/lib/v3/copy'
import { HeroStory } from './HeroStory'
import { Button, Frame, Label } from './primitives'
import './hero.css'

const H = V3.hero
/** Headline words in order, each with its place in the blur-up; the label and the side column follow them. */
const LINES = H.headline.reduce<Array<Array<{ word: string; at: number }>>>((acc, line) => {
  const start = acc.flat().length
  return [...acc, line.split(' ').map((word, k) => ({ word, at: start + k }))]
}, [])
const AFTER = LINES.flat().length
const at = (n: number) => ({ '--i': n }) as CSSProperties

/** The v3 hero: label, headline and lede with a one-time word blur-up, then the story panel in a ruled frame. */
export function Hero() {
  // The painting is the page's LCP, but as a CSS background it is found only after the stylesheet. Preload the same file
  // hero.css picks: with "1px" below 1201px the 1200w file always suffices; above it, 100vw picks the 2600w one.
  preload('/v3/dusk-1200.webp', { as: 'image', fetchPriority: 'high', imageSrcSet: '/v3/dusk-1200.webp 1200w, /v3/dusk.webp 2600w', imageSizes: '(min-width: 1201px) 100vw, 1px' })
  return (
    <section className="v3-hero" aria-labelledby="v3-hero-title">
      <div className="v3-hero-head">
        <div className="v3-hero-title">
          <div className="v3-hero-in" style={at(AFTER)}><Label>{H.label}</Label></div>
          <h1 id="v3-hero-title" className="v3-display" aria-label={H.headline.join(' ')}>
            {LINES.map((words, l) => (
              <span key={l}>
                {l ? <br /> : null}
                {words.map(({ word, at: n }, k) => (
                  <span key={n}>{k ? ' ' : null}<span className="v3-hero-w v3-hero-in" style={at(n)}>{word}</span></span>
                ))}
              </span>
            ))}
          </h1>
        </div>
        <div className="v3-hero-side">
          <p className="v3-lede v3-hero-in" style={at(AFTER + 1)}>{H.lede}</p>
          <div className="v3-hero-actions v3-hero-in" style={at(AFTER + 2)}>
            <Button href="/docs" kind="ink" arrow>{H.primary}</Button>
            <Button href={REPO_URL} kind="outline">{H.secondary}</Button>
          </div>
        </div>
      </div>
      <Frame className="v3-hero-frame">
        <HeroStory />
      </Frame>
    </section>
  )
}
