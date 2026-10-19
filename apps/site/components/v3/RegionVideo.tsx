'use client'
import { useEffect, useRef } from 'react'
import { V3 } from '@/lib/v3/copy'
import { useSequence } from '@/lib/v3/inview'
import { videoAction } from '@/lib/v3/video-play'
import { Button, Glass, Label } from './primitives'
import './region-video.css'

const T = V3.video
const SOURCES = [['/v3/video/region.webm', 'video/webm'], ['/v3/video/region.mp4', 'video/mp4']] as const

/** Adds the WebM and MP4 sources the first time the video is wanted, so reduced-motion visitors never download it. */
function attachSources(video: HTMLVideoElement) {
  if (video.querySelector('source')) return
  for (const [src, type] of SOURCES) {
    const source = document.createElement('source')
    source.src = src
    source.type = type
    video.appendChild(source)
  }
  video.load()
}

/** In the region: words on the left, a muted looping video on the right with a glass check chip. The poster is a low priority image; the video loads and plays only while visible and never under reduced motion. */
export function RegionVideo() {
  const section = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const { visible, reduced } = useSequence(section)

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (videoAction(visible, reduced) === 'pause') {
      el.pause()
      return
    }
    attachSources(el)
    const on = () => el.setAttribute('data-playing', '')
    el.addEventListener('playing', on, { once: true })
    el.play().catch(() => { /* autoplay refused: the poster stays */ })
  }, [visible, reduced])

  return (
    <section ref={section} className="v3-rv" aria-labelledby="v3-rv-title">
      <div className="v3-rv-words">
        <Label>{T.label}</Label>
        <h2 id="v3-rv-title" className="v3-display">{T.heading.split('\n').map((line, i) => <span key={i}>{i ? <br /> : null}{line}</span>)}</h2>
        <p className="v3-lede v3-rv-lede">{T.lede}</p>
        <Button href="/docs" kind="ink" arrow>{T.action}</Button>
      </div>
      <div className="v3-rv-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="v3-rv-poster" src="/v3/video/region-poster.webp" alt="" width={1080} height={1620} loading="lazy" decoding="async" fetchPriority="low" aria-hidden="true" />
        <video ref={video} className="v3-rv-video" muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
        <Glass className="v3-rv-chip">
          <span className="v3-pv-dot" aria-hidden="true" />
          <span className="v3-mono">{T.chip[0]}</span>
          <span className="v3-glass-soft">{T.chip[1]}</span>
        </Glass>
      </div>
    </section>
  )
}
