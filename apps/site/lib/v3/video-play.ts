export type VideoAction = 'play' | 'pause'

/** The video plays only while its section is visible, and never under reduced motion. */
export function videoAction(visible: boolean, reduced: boolean): VideoAction {
  return visible && !reduced ? 'play' : 'pause'
}
