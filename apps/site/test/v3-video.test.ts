import { describe, expect, it } from 'vitest'
import { videoAction } from '../lib/v3/video-play'

describe('videoAction', () => {
  it('plays only when visible and motion is allowed', () => {
    expect(videoAction(true, false)).toBe('play')
    expect(videoAction(false, false)).toBe('pause')
  })
  it('never plays under reduced motion', () => {
    expect(videoAction(true, true)).toBe('pause')
    expect(videoAction(false, true)).toBe('pause')
  })
})
