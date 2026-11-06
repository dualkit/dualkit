import { RULES, docsUrl, type Rule } from '@dualkit/rules'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { failure, handle, lenient, result, says, text } from '../schema'

const id = text('id', 'a rule id, such as bidi/unisolated-number').describe('A rule id, such as bidi/unisolated-number. Leave it out to list every rule.')
const input = z.strictObject({ id: id.optional() }, says('the input', 'an object'))

const summary = (r: Rule) => ({ id: r.id, group: r.group, severity: r.severity, title: r.title, fix: r.fix, docs: docsUrl(r.id) })

function run({ id: wanted }: z.infer<typeof input>): CallToolResult {
  if (wanted === undefined) return result({ rules: RULES.map(summary) })
  const rule = RULES.find((r) => r.id === wanted)
  if (!rule) return failure(`There is no rule called ${wanted}. Call rules with no id to list them.`)
  return result({ id: rule.id, group: rule.group, severity: rule.severity, title: rule.title, why: rule.why, fix: rule.fix, docs: docsUrl(rule.id) })
}

export function registerRules(server: McpServer): void {
  server.registerTool('rules', {
    title: 'Dualkit rules',
    description: 'Lists the Arabic and right-to-left rules that dualkit check runs, with each one\'s severity, fix and docs link, or looks one up by id with why it matters.',
    inputSchema: lenient({ id: id.optional() }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, run))
}
