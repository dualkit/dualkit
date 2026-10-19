import { describe, expect, it } from 'vitest'
import { videoAction } from '../lib/v3/video-play'

describe('videoAction', () => {
  it('plays only when visible and motion is allowed', () => {
    expect(videoAction(true, false)).toBe('play')
    expect(videoAction(false, false)).toBe('pause')
  })
  it('never plays on its own under reduced motion', () => {
    expect(videoAction(true, true)).toBe('pause')
    expect(videoAction(false, true)).toBe('pause')
  })
  it('stays paused once the visitor pauses it', () => {
    expect(videoAction(true, false, 'paused')).toBe('pause')
  })
  it('plays under reduced motion only when the visitor asks, and only while visible', () => {
    expect(videoAction(true, true, 'playing')).toBe('play')
    expect(videoAction(false, true, 'playing')).toBe('pause')
  })
})
