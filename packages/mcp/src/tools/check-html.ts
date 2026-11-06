import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { CHECKED, NOT_CHECKED } from '../check-core'
import { runCheck } from '../run-check'
import { INTERNAL_ERROR, failure, handle, lenient, logError, result, says } from '../schema'

const KB = 1024
/** jsdom reads a dense 512 KB page in about 6 seconds, inside the time limit; 1 MB takes longer than it. */
export const MAX_HTML_BYTES = 512 * KB
/** A check that runs longer than this is stopped. */
export const CHECK_TIMEOUT_MS = 10_000

const html = z.string(says('html', 'the page or fragment to check, as a string'))
  .describe('The HTML of one page or fragment. Scripts do not run and nothing is fetched. Up to 512 KB.')
const input = z.strictObject({ html }, says('the input', 'an object'))

const tooSlow = (timeoutMs: number) =>
  `The check took longer than ${timeoutMs / 1000} seconds, so it was stopped. Send a smaller page, or the part you changed.`

function checker(timeoutMs: number) {
  return async ({ html: markup }: z.infer<typeof input>, signal?: AbortSignal): Promise<CallToolResult> => {
    if (markup.trim() === '') return failure('The HTML is empty. Send the markup to check.')
    const bytes = Buffer.byteLength(markup, 'utf8')
    if (bytes > MAX_HTML_BYTES) {
      const size = `${Math.ceil(bytes / KB)} KB`
      return failure(`The HTML is ${size}, and check_html reads up to ${MAX_HTML_BYTES / KB} KB. Send one page, or the part you changed.`)
    }
    const outcome = await runCheck(markup, timeoutMs, signal)
    switch (outcome.kind) {
      case 'done': return result({ findings: outcome.findings, checked: CHECKED.map((r) => r.id), notChecked: NOT_CHECKED })
      case 'timeout': return failure(tooSlow(timeoutMs))
      case 'cancelled': return failure('The check was cancelled.')
      case 'failed':
        logError(outcome.detail)
        return failure(INTERNAL_ERROR)
    }
  }
}

export function registerCheckHtml(server: McpServer, timeoutMs: number = CHECK_TIMEOUT_MS): void {
  server.registerTool('check_html', {
    title: 'Check HTML for Arabic and RTL bugs',
    description: 'Runs the Dualkit rules on an HTML string in jsdom, with no browser: numbers and links that scramble in Arabic text, dates in the wrong order, punctuation at the wrong end, missing lang and dir, mixed digits, Latin punctuation and more. Rules that need layout, fonts or a real browser are listed under notChecked with the reason; run npx dualkit check on a URL for those.',
    inputSchema: lenient({ html }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, checker(timeoutMs)))
}
