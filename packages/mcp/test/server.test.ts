import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VERSION } from '../src/server'
import { useClient } from './helpers'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { client } = useClient()

describe('server', () => {
  it('lists the four tools with their input schemas', async () => {
    const { tools } = await client().listTools()
    expect(tools.map((t) => t.name)).toEqual(['format', 'validate', 'rules', 'check_html'])
    expect(tools).toMatchSnapshot()
  })

  it('every tool says what it does, and every input has a description', async () => {
    const { tools } = await client().listTools()
    for (const tool of tools) {
      expect(tool.description).toMatch(/\.$/)
      for (const [name, prop] of Object.entries(tool.inputSchema.properties ?? {})) {
        expect((prop as { description?: string }).description, `${tool.name}.${name}`).toBeTruthy()
      }
    }
  })

  it('reports its name and the package version', () => {
    expect(client().getServerVersion()).toEqual({ name: 'dualkit', version: pkg.version })
    expect(VERSION).toBe(pkg.version)
  })

  it('exports createServer for other transports', async () => {
    const index = await import('../src/index')
    expect(index.createServer().server).toBeDefined()
    expect(index.MAX_HTML_BYTES).toBe(512 * 1024)
    expect(index.CHECK_TIMEOUT_MS).toBe(10_000)
  })

  it('turns an unknown tool into a tool error', async () => {
    const result = await client().callTool({ name: 'nope', arguments: {} })
    expect(result.isError).toBe(true)
  })
})

describe('package metadata', () => {
  it('runs with npx @dualkit/mcp', () => {
    expect(pkg.name).toBe('@dualkit/mcp')
    expect(Object.values(pkg.bin)).toEqual(['./dist/cli.js'])
  })

  it('ships the licence', () => {
    expect(pkg.files).toContain('LICENSE')
  })
})
