export type Clock = {
  now(): number
  play(): void
  pause(): void
  /** Moves the playhead. Silent: read now() afterwards; only a running clock emits ticks. */
  seek(ms: number): void
  onTick(fn: (t: number) => void): () => void
}

export type ClockEnv = {
  raf: (cb: (ts: number) => void) => number
  cancel: (id: number) => void
  now: () => number
}

const browserEnv = (): ClockEnv => ({
  raf: (cb) => window.requestAnimationFrame(cb),
  cancel: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
})

/** One rAF loop per section. The environment is resolved lazily so importing is server safe. */
export function createClock(env?: ClockEnv): Clock {
  let position = 0
  let last = 0
  let frame: number | null = null
  let playing = false
  const listeners = new Set<(t: number) => void>()
  let resolved: ClockEnv | null = env ?? null
  const e = (): ClockEnv => (resolved ??= browserEnv())

  const loop = () => {
    frame = null
    const t = e().now()
    position += t - last
    last = t
    listeners.forEach((fn) => fn(position))
    if (playing && frame === null) frame = e().raf(loop)
  }

  return {
    now: () => position,
    play() {
      playing = true
      if (frame !== null) return
      last = e().now()
      frame = e().raf(loop)
    },
    pause() {
      playing = false
      if (frame === null) return
      e().cancel(frame)
      frame = null
    },
    seek(ms) {
      position = ms
    },
    onTick(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}
