// One persistent glass layer behind a set of crossfading previews. The layer's panes keep their backdrop blur at full
// opacity for the life of the page; switching previews only moves each pane's clip-path to the new preview's glass
// boxes, and the previews' own glass loses its fill and blur (it keeps the 1px ring and the text, which crossfade).
// Pure geometry, so the tests cover it without a DOM.

export type Box = { left: number; top: number; right: number; bottom: number }

/** How many panes a stage keeps: the most glass boxes any preview has (Starter has eight cells). */
export const GLASS_POOL = 8

const px = (n: number) => `${Math.round(n * 100) / 100}px`
/** One clip edge measured from the stage centre, so the clip stays put when the stage only grows or shrinks around it. */
const edge = (fromCentre: number) => (fromCentre >= 0 ? `calc(50% + ${px(fromCentre)})` : `calc(50% - ${px(-fromCentre)})`)

/** clip-path inset() that shows exactly `box` (viewport px) on a pane that fills `stage`. */
export function insetFor(box: Box, stage: Box): string {
  const cx = (stage.left + stage.right) / 2
  const cy = (stage.top + stage.bottom) / 2
  return `inset(${edge(box.top - cy)} ${edge(cx - box.right)} ${edge(cy - box.bottom)} ${edge(box.left - cx)})`
}

/** A zero-area box at the centre of `box`: where a pane that is not needed collapses to (and grows from). */
export const pointOf = (box: Box): Box => {
  const x = (box.left + box.right) / 2
  const y = (box.top + box.bottom) / 2
  return { left: x, top: y, right: x, bottom: y }
}

/** `from`: where a pane that was folded away starts, so it grows out of its own box instead of flying across the stage. */
export type PaneState = { clip: string; used: boolean; from?: string }

/**
 * Every pane's clip for the given glass boxes (`previous`: the boxes before the switch). One pane per box; a pane that is
 * no longer needed folds into the centre of the box it showed, and a pane that comes back grows from its new box's centre.
 */
export function paneStates(boxes: readonly Box[], stage: Box, previous: readonly Box[] = [], pool = GLASS_POOL): PaneState[] {
  return Array.from({ length: pool }, (_, i) => {
    const box = boxes[i]
    const before = previous[i]
    if (!box) return { clip: insetFor(pointOf(before ?? boxes[0] ?? stage), stage), used: false }
    return before ? { clip: insetFor(box, stage), used: true } : { clip: insetFor(box, stage), used: true, from: insetFor(pointOf(box), stage) }
  })
}
