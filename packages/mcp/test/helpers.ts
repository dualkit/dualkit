import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll } from 'vitest'
import { createServer } from '../src/server'

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[] }

/** A real client wired to the server over the SDK's in-memory transport, opened once per test file. */
export function useClient(): { call: (name: string, args: Record<string, unknown>) => Promise<ToolResult>; client: () => Client } {
  let client: Client
  beforeAll(async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await createServer().connect(serverSide)
    client = new Client({ name: 'test', version: '0' })
    await client.connect(clientSide)
  })
  afterAll(async () => { await client.close() })
  return {
    call: async (name, args) => (await client.callTool({ name, arguments: args })) as ToolResult,
    client: () => client,
  }
}

/** The JSON a successful call returned. */
export function json(result: ToolResult): unknown {
  if (result.isError) throw new Error(`Expected success, got: ${text(result)}`)
  return JSON.parse(text(result))
}

export function text(result: ToolResult): string {
  return result.content.map((c) => c.text ?? '').join('\n')
}

/** Tool errors are plain sentences: no stack frames, no JSON, no zod issue dumps. */
export function expectPlainError(result: ToolResult): string {
  if (!result.isError) throw new Error(`Expected a tool error, got: ${text(result)}`)
  const message = text(result)
  if (/\n\s+at |[{[]"|"code":|"path":/.test(message)) throw new Error(`Not a plain sentence: ${message}`)
  if (!/[.?]$/.test(message.trim())) throw new Error(`Does not end as a sentence: ${message}`)
  return message
}
