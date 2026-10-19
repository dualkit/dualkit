// Slide to pay geometry. Pure, so the tests cover it without a DOM.

/** The track measured once per gesture or animation: reading layout inside a frame after a write would force layout. */
export type SlideMetrics = { max: number; inset: number; thumb: number; radius: string }

/** How far the thumb may travel: the track's inner width less the thumb and the padding on both sides. */
export const slideTravel = (trackWidth: number, thumb: number, inset: number): number => Math.max(0, trackWidth - thumb - inset * 2)

/** The filled length at progress p: from the track's start edge to the thumb's centre. */
export const fillLength = (p: number, m: SlideMetrics): number => p * m.max + m.thumb / 2 + m.inset

/**
 * The fill spans the whole track and is cut back with clip-path from the inline end, so the fill never changes width
 * (a layout property) and the glass behind it never repaints for it. `round` keeps the pill's end round.
 */
export function fillClip(length: number, rtl: boolean, radius: string): string {
  const cut = `calc(100% - ${Math.max(0, length).toFixed(2)}px)`
  return `inset(0 ${rtl ? '0' : cut} 0 ${rtl ? cut : '0'} round ${radius})`
}
