import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { Footer } from '@/components/v3/Footer'
import { Nav } from '@/components/v3/Nav'
import { Label } from '@/components/v3/primitives'
import { liveData } from '@/lib/live'
import '@/components/v3/hero.css'
import '@/components/v3/sec.css'
import './careers.css'

export const at = (n: number) => ({ '--i': n }) as CSSProperties

/** Nav, main and footer around every careers page. */
export async function CareersShell({ children }: { children: ReactNode }) {
  const live = await liveData()
  return (
    <>
      <Nav stars={live.stars} />
      <main className="v3 cr">{children}</main>
      <Footer status={live.status} downloads={live.downloads} />
    </>
  )
}

/** The page title as the home hero draws it: each word blurs up on load, 60ms apart. Returns the count so the side column can follow. */
export function Headline({ id, label, lines, after }: { id: string; label: string; lines: readonly string[]; after?: ReactNode }) {
  const words = lines.flatMap((line, l) => line.split(' ').map((word, k) => ({ word, l, first: k === 0 })))
  return (
    <div className="v3-hero-title">
      <div className="v3-hero-in" style={at(words.length)}><Label>{label}</Label></div>
      <h1 id={id} className="v3-display" aria-label={lines.join(' ')}>
        {words.map(({ word, l, first }, n) => (
          <span key={n}>{first && l ? <br /> : n ? ' ' : null}<span className="v3-hero-w v3-hero-in" style={at(n)}>{word}</span></span>
        ))}
      </h1>
      {after}
    </div>
  )
}

export const wordCount = (lines: readonly string[]) => lines.join(' ').split(' ').length

const BACK = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.5" /></svg>
)

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="cr-back" href={href}>{BACK}{children}</Link>
}
