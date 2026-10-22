/** How a reviewer labelled one finding a tool reported. */
export type Label = 'real' | 'handled' | 'intended' | 'unclear'

/** Counts of labelled findings the tool still reports. */
export type Tally = {
  readonly real: number
  readonly handled: number
  readonly intended: number
  readonly unclear: number
}

/** Whether one tool caught one known bug. */
export type CaseResult = {
  readonly id: string
  readonly kind: string
  readonly tool: 'check' | 'lint' | 'review' | 'dualkit'
  readonly caught: boolean
}
