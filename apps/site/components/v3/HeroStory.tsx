'use client'
import { useEffect, useRef } from 'react'
import { useSequence } from '@/lib/v3/inview'
import { settleStory, startStory, type StoryHandle } from '@/lib/v3/story-engine'
import { storyHTML } from '@/lib/v3/story-markup'

// The same string on the server and the client: the settled frame (fixed Arabic panel, rail on "Checked").
// With motion allowed, CSS hides it until the engine has rebuilt the broken frame and taken over.
const MARKUP = { __html: storyHTML() }

/** The glass panel on the painting: without Dualkit, install, six fixes, checked, both directions. */
export function HeroStory() {
  const ref = useRef<HTMLDivElement>(null)
  const engine = useRef<StoryHandle | null>(null)
  const { visible, reduced } = useSequence(ref, { threshold: 0.35 })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (reduced) return settleStory(root)
    const handle = startStory(root)
    engine.current = handle
    return () => {
      handle.destroy()
      engine.current = null
    }
  }, [reduced])

  useEffect(() => {
    engine.current?.setVisible(visible)
  }, [visible, reduced])

  return <div ref={ref} className="v3-story" dangerouslySetInnerHTML={MARKUP} />
}
