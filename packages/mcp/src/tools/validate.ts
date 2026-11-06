import { parseEmiratesId, parseGulfPhone, parseIban, parseSaudiVatNumber } from '@dualkit/format'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { GULF_COUNTRIES, PHONES } from '../phones'
import { handle, lenient, oneOf, result, says, strictFor, text } from '../schema'

const KINDS = ['iban', 'emirates_id', 'saudi_vat', 'phone'] as const

const value = text('value', 'the text to check, as a string').describe('The value as typed. Spaces, dashes and Arabic digits are fine.')
const country = z.enum(GULF_COUNTRIES, says('country', oneOf(GULF_COUNTRIES)))
  .describe(`iban and phone only: ${oneOf(GULF_COUNTRIES)}. For iban it requires that country. For phone it reads a national number of that country; leave it out for an international number from any GCC country.`)

const input = z.discriminatedUnion('kind', [
  strictFor('iban', { kind: z.literal('iban'), value, country: country.optional() }),
  strictFor('emirates_id', { kind: z.literal('emirates_id'), value }),
  strictFor('saudi_vat', { kind: z.literal('saudi_vat'), value }),
  strictFor('phone', { kind: z.literal('phone'), value, country: country.optional() }),
], { error: `kind must be ${oneOf(KINDS)}.` })

function run(i: z.infer<typeof input>): CallToolResult {
  switch (i.kind) {
    case 'iban': return result(parseIban(i.value, i.country ? { country: i.country } : {}))
    case 'emirates_id': return result(parseEmiratesId(i.value))
    case 'saudi_vat': return result(parseSaudiVatNumber(i.value))
    case 'phone': return result(i.country ? PHONES[i.country].parse(i.value) : parseGulfPhone(i.value))
  }
}

export function registerValidate(server: McpServer): void {
  server.registerTool('validate', {
    title: 'Validate Gulf identifiers',
    description: 'Checks a Gulf IBAN, Emirates ID, Saudi VAT number or GCC phone number with @dualkit/format, and returns its result unchanged: { ok: true, value } or { ok: false, error: { code, message } }. An invalid value is a normal result, not a tool error; the code is stable, so map it to your own copy.',
    inputSchema: lenient({
      kind: z.enum(KINDS).describe(`${oneOf(KINDS)}.`),
      value,
      country: country.optional(),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, run))
}
