import { describe, expect, it } from 'vitest'
import { GLASS_POOL, insetFor, paneStates, pointOf } from '../lib/v3/glass-stage'

const stage = { left: 100, top: 50, right: 700, bottom: 650 } // centre 400, 350

describe('glass stage', () => {
  it('clips a pane to a box, each edge measured from the stage centre', () => {
    expect(insetFor({ left: 200, top: 250, right: 580, bottom: 400 }, stage)).toBe('inset(calc(50% - 100px) calc(50% - 180px) calc(50% - 50px) calc(50% - 200px))')
  })
  it('keeps the box when the stage grows around its centre', () => {
    const box = { left: 200, top: 250, right: 580, bottom: 400 }
    const taller = { left: 100, top: 0, right: 700, bottom: 700 }
    expect(insetFor(box, taller)).toBe(insetFor(box, stage))
  })
  it('uses calc(50% + n) for an edge past the centre', () => {
    expect(insetFor({ left: 450, top: 400, right: 500, bottom: 420 }, stage)).toBe('inset(calc(50% + 50px) calc(50% - 100px) calc(50% - 70px) calc(50% + 50px))')
  })
  const a = { left: 200, top: 250, right: 300, bottom: 350 }
  const b = { left: 320, top: 250, right: 420, bottom: 350 }
  it('gives one pane per box and folds the spare panes into the first box centre', () => {
    const s = paneStates([a, b], stage, [a, b])
    expect(s).toHaveLength(GLASS_POOL)
    expect(s.filter((p) => p.used)).toHaveLength(2)
    expect(s[1]).toEqual({ clip: insetFor(b, stage), used: true })
    expect(s[5]).toEqual({ clip: insetFor(pointOf(a), stage), used: false })
  })
  it('folds a pane that is no longer needed into the box it showed', () => {
    const s = paneStates([a], stage, [a, b])
    expect(s[1]).toEqual({ clip: insetFor(pointOf(b), stage), used: false })
  })
  it('grows a returning pane from the centre of its new box', () => {
    const s = paneStates([a, b], stage, [a])
    expect(s[0]!.from).toBeUndefined()
    expect(s[1]).toEqual({ clip: insetFor(b, stage), used: true, from: insetFor(pointOf(b), stage) })
  })
  it('folds every pane into the stage centre when there is no glass', () => {
    expect(paneStates([], stage).every((p) => !p.used && p.clip === 'inset(calc(50% + 0px) calc(50% + 0px) calc(50% + 0px) calc(50% + 0px))')).toBe(true)
  })
})
