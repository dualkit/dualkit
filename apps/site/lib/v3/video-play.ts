export type VideoAction = 'play' | 'pause'
/** What the visitor chose with the pause button: nothing yet, paused, or played. */
export type VideoChoice = 'auto' | 'paused' | 'playing'

/** The video plays only while its section is visible. Until the visitor chooses, it plays unless motion is reduced;
 *  after that, the choice wins. */
export function videoAction(visible: boolean, reduced: boolean, choice: VideoChoice = 'auto'): VideoAction {
  if (!visible || choice === 'paused') return 'pause'
  if (choice === 'playing') return 'play'
  return reduced ? 'pause' : 'play'
}
