import { RULES, runRules, type Finding } from '@dualkit/rules'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { JSDOM_CHECKED, JSDOM_NOT_CHECKED, UNCLASSIFIED } from '../jsdom-coverage'
import { readHtml } from '../jsdom-screen'
import { failure, handle, lenient, result, says } from '../schema'

export const MAX_HTML_BYTES = 2 * 1024 * 1024
const MB = 1024 * 1024

const html = z.string(says('html', 'the page or fragment to check, as a string'))
  .describe('The HTML of one page or fragment. Scripts do not run and nothing is fetched. Up to 2 MB.')
const input = z.strictObject({ html }, says('the input', 'an object'))

const checkedSet = new Set(JSDOM_CHECKED)
const CHECKED = RULES.filter((r) => checkedSet.has(r.id))
const NOT_CHECKED = RULES.filter((r) => !checkedSet.has(r.id)).map((r) => ({ rule: r.id, reason: JSDOM_NOT_CHECKED[r.id] ?? UNCLASSIFIED }))

/** The box is jsdom's placeholder, not a measurement, so findings name the element by id and snippet only. */
const withoutBox = ({ node, ...f }: Finding) => ({ ...f, node: node && { id: node.id, snippet: node.snippet } })

function run({ html: markup }: z.infer<typeof input>): CallToolResult {
  if (markup.trim() === '') return failure('The HTML is empty. Send the markup to check.')
  const bytes = Buffer.byteLength(markup, 'utf8')
  if (bytes > MAX_HTML_BYTES) {
    return failure(`The HTML is ${(bytes / MB).toFixed(1)} MB, and check_html reads up to 2 MB. Send one page, or the part you changed.`)
  }
  const findings = runRules(readHtml(markup), { rules: CHECKED }).map(withoutBox)
  return result({ findings, checked: CHECKED.map((r) => r.id), notChecked: NOT_CHECKED })
}

export function registerCheckHtml(server: McpServer): void {
  server.registerTool('check_html', {
    title: 'Check HTML for Arabic and RTL bugs',
    description: 'Runs the Dualkit rules on an HTML string in jsdom, with no browser: numbers and links that scramble in Arabic text, dates in the wrong order, punctuation at the wrong end, missing lang and dir, mixed digits, Latin punctuation and more. Rules that need layout, fonts or a real browser are listed under notChecked with the reason; run npx dualkit check on a URL for those.',
    inputSchema: lenient({ html }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, run))
}
