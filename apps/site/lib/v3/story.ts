// The hero story timeline, ported from the approved prototype design/prototypes/hero3/index.html.
// Without Dualkit, install, six fixes, checked, then both directions. Times are ms on the story clock.

export type ChapterId = 'broken' | 'install' | 'direction' | 'bidi' | 'type' | 'hijri' | 'money' | 'iban' | 'checked'
export type Chapter = { readonly id: ChapterId; readonly start: number; readonly end: number }
export type FixId = Exclude<ChapterId, 'broken' | 'install' | 'checked'>

export const INSTALL_AT = 2400
/** Five fixes get 2.05 s; the IBAN gets 2.8 s so its result has a beat. */
export const FIX_MS = [2050, 2050, 2050, 2050, 2050, 2800] as const
export const FIX_IDS: readonly FixId[] = ['direction', 'bidi', 'type', 'hijri', 'money', 'iban']
const FIRST_FIX = 4200
export const FIX_AT: readonly number[] = FIX_MS.map((_, i) => FIRST_FIX + FIX_MS.slice(0, i).reduce((a, b) => a + b, 0))
export const CHECK_AT = FIRST_FIX + FIX_MS.reduce((a, b) => a + b, 0)
const CHECK_MS = 5400
export const LOOP_MS = CHECK_AT + CHECK_MS

export const CHAPTERS: readonly Chapter[] = [
  { id: 'broken', start: 0, end: INSTALL_AT },
  { id: 'install', start: INSTALL_AT, end: FIRST_FIX },
  ...FIX_IDS.map((id, i) => ({ id, start: FIX_AT[i]!, end: FIX_AT[i]! + FIX_MS[i]! })),
  { id: 'checked', start: CHECK_AT, end: LOOP_MS },
]

export function chapterAt(t: number): Chapter {
  const found = CHAPTERS.find((c) => t >= c.start && t < c.end)
  if (found) return found
  return t < 0 ? CHAPTERS[0]! : CHAPTERS[CHAPTERS.length - 1]!
}

/** Beats inside the loop, all relative to the start of their chapter. */
export const BEATS = {
  build: { ringMs: 900, bgDelay: 100, bgMs: 500, rowsAt: 300, rowStagger: 160, countAt: 460, pinsAt: 1300, pinStagger: 130, railAt: 1200, railFadeAt: 1150 },
  install: { stripAt: 300, typeAt: 700, typePerChar: 22, loadedAt: 1480, squareStagger: 110 },
  fix: { camMs: 800, runAt: 700, fixedAt: 1600, resolveAt: [1500, 1800, 1500, 1500, 1600, 1950] as const, zoom: [1.04, 1.3, 1.3, 1.3, 1.3, 1.3] as const },
  checked: { camMs: 900, zoom: 0.96, scanAt: 500, payAt: 1100, toEnglishAt: 1600, toArabicAt: 3100 },
  /** The loop closes: content fades, the ring retracts, the camera returns, the build starts again. */
  close: { contentFadeBefore: 500, ringBefore: 100, camAfter: 300, camMs: 700 },
  /** Ticks rebuild the state under a dissolve, so the seek never cuts. */
  seekDissolveMs: 240,
} as const

/** The damped spring every mirror uses: zeta 0.75, settling (2%) in about 550 ms, sampled over 760 ms. */
export const MIRROR_SPRING = { zeta: 0.75, settleMs: 550, sampleMs: 760 } as const
export const SWAP_GAP_MS = 60

/** When the loop restarts: the close beat ends one second after LOOP_MS. */
export const RESTART_MS = LOOP_MS + BEATS.close.camAfter + BEATS.close.camMs

/** The share of the gap the hover glow closes per 60Hz frame. */
export const SPEC_FOLLOW = 0.18
const FRAME_60_MS = 1000 / 60

/** The share of the gap to close over a frame of `dt` ms, so the glow follows at the same speed at 60Hz and 120Hz. */
export const followFactor = (perFrame: number, dt: number): number => (dt > 0 ? 1 - Math.pow(1 - perFrame, dt / FRAME_60_MS) : 0)
