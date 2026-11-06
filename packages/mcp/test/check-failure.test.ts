import { describe, expect, it, vi } from 'vitest'
import { INTERNAL_ERROR } from '../src/schema'
import { expectPlainError, useClient } from './helpers'

vi.mock('../src/run-check', () => ({
  runCheck: async () => ({ kind: 'failed', detail: 'Error: worker crashed\n    at /home/sam/dist/check-worker.js:1:1' }),
}))

const { call } = useClient()

describe('check_html when its worker fails', () => {
  it('answers with one plain sentence and logs the detail to stderr', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      expect(expectPlainError(await call('check_html', { html: '<p>x</p>' }))).toBe(INTERNAL_ERROR)
      expect(String(write.mock.calls[0]?.[0])).toMatch(/worker crashed/)
    } finally {
      write.mockRestore()
    }
  })
})
