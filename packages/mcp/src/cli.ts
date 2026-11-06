import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'

// stdout carries the protocol, so anything for a person goes to stderr.
createServer().connect(new StdioServerTransport()).catch((error: unknown) => {
  process.stderr.write(`dualkit-mcp could not start: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
