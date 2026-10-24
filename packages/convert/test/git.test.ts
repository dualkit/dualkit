import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { NO_GIT, currentBranch } from '../src/git'

describe('git', () => {
  it('names a missing folder instead of blaming git', async () => {
    const missing = join(tmpdir(), `dualkit-missing-${process.pid}-${Date.now()}`)
    const error = (await currentBranch(missing).catch((e: unknown) => e)) as Error
    expect(error.message).not.toBe(NO_GIT)
    expect(error.message).toBe(`The folder ${missing} does not exist.`)
  })
})
