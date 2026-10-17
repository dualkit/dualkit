import { describe, expect, it } from 'vitest'
import { iconRules } from '../../src/rules/icons'
import { runRules } from '../../src/run'
import { icon, screen } from '../helpers/model'

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: iconRules }).map((f) => f.rule)

describe('icons/not-mirrored', () => {
  it.each(['arrow-right', 'chevron-left', 'lucide-chevron-right', 'back', 'send', 'caret_left'])('flags %s in RTL when not mirrored', (name) => {
    expect(ids(screen({ icons: [icon({ name })] }))).toEqual(['icons/not-mirrored'])
  })
  it.each(['fast-forward', 'fast-back', 'skip-next', 'skip-back', 'skip-forward', 'media-next', 'player-play-next', 'seek-forward', 'seek-back'])('leaves the media control %s alone', (name) => {
    expect(ids(screen({ icons: [icon({ name })] }))).toEqual([])
  })
  it('passes mirrored icons, LTR icons, unnamed and non-directional icons', () => {
    expect(ids(screen({ icons: [icon({ mirrored: true }), icon({ dir: 'ltr' }), icon({ name: null }), icon({ name: 'search' })] }))).toEqual([])
  })
})

describe('icons/mirrored-by-mistake', () => {
  it.each(['play', 'check', 'clock', 'brand-logo'])('flags a mirrored %s', (name) => {
    expect(ids(screen({ icons: [icon({ name, mirrored: true })] }))).toEqual(['icons/mirrored-by-mistake'])
  })
  it('does not confuse playlist or checkout with play and check', () => {
    expect(ids(screen({ icons: [icon({ name: 'playlist', mirrored: true }), icon({ name: 'checkout', mirrored: true })] }))).toEqual([])
  })
  it.each(['help', 'question', 'help-circle', 'circle-question'])('accepts a mirrored %s, because the Arabic question mark is mirrored', (name) => {
    expect(ids(screen({ icons: [icon({ name, mirrored: true })] }))).toEqual([])
  })
})
