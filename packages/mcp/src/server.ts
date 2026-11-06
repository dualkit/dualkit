import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerCheckHtml } from './tools/check-html'
import { registerFormat } from './tools/format'
import { registerRules } from './tools/rules'
import { registerValidate } from './tools/validate'

export const VERSION = '0.1.0-beta.0'

const INSTRUCTIONS = 'Dualkit tools for products that ship in Arabic and English in the Gulf. Use format and validate instead of writing your own money, Hijri, phone, IBAN, Emirates ID or VAT logic. Use check_html on markup you wrote for Arabic or right-to-left pages, and rules to read what a finding means.'

/** The Dualkit MCP server with its four tools. Connect it to any transport. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'dualkit', version: VERSION }, { instructions: INSTRUCTIONS })
  registerFormat(server)
  registerValidate(server)
  registerRules(server)
  registerCheckHtml(server)
  return server
}
