import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const action = readFileSync(new URL('../../../action/action.yml', import.meta.url), 'utf8')
const readme = new URL('../../../action/README.md', import.meta.url)

describe('the GitHub Action', () => {
  it('edits its last PR comment, and falls back to a new one', () => {
    expect(action).toContain('gh pr comment "$PR" --repo "$GITHUB_REPOSITORY" --edit-last --body-file dualkit-summary.md || gh pr comment "$PR" --repo "$GITHUB_REPOSITORY" --body-file dualkit-summary.md || echo')
  })

  it('has a README that documents every input and output, Node 22, the permission and a preview URL', () => {
    expect(existsSync(readme)).toBe(true)
    const text = readFileSync(readme, 'utf8')
    const inputs = [...action.matchAll(/^ {2}([a-z-]+): \{ description/gm)].map((m) => m[1]!)
    expect(inputs.length).toBeGreaterThan(5)
    for (const name of [...inputs, 'score']) expect(text, name).toContain(`\`${name}\``)
    expect(text).toContain('Node 22')
    expect(text).toContain('pull-requests: write')
    expect(text).toMatch(/preview/i)
    expect(text).not.toContain('—')
  })
})
