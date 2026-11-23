import {
  NATIONAL_ID_COUNTRIES, parseEmiratesId, parseGulfPhone, parseIban, parseNationalId, parseSaudiVatNumber, type NationalIdCountry,
} from '@dualkit/format'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { GULF_COUNTRIES, PHONES } from '../phones'
import { handle, lenient, oneOf, result, says, strictFor, text } from '../schema'

const KINDS = ['iban', 'emirates_id', 'national_id', 'saudi_vat', 'phone'] as const
const ID_COUNTRIES = NATIONAL_ID_COUNTRIES as readonly [NationalIdCountry, ...NationalIdCountry[]]

const value = text('value', 'the text to check, as a string').describe('The value as typed. Spaces, dashes and Arabic digits are fine.')
const country = z.enum(GULF_COUNTRIES, says('country', oneOf(GULF_COUNTRIES)))
  .describe(`iban, phone and national_id: ${oneOf(GULF_COUNTRIES)}. national_id needs it, and takes ${oneOf(ID_COUNTRIES)}. For iban it requires that country. For phone it reads a national number of that country; leave it out for an international number from any GCC country.`)

const input = z.discriminatedUnion('kind', [
  strictFor('iban', { kind: z.literal('iban'), value, country: country.optional() }),
  strictFor('emirates_id', { kind: z.literal('emirates_id'), value }),
  strictFor('national_id', {
    kind: z.literal('national_id'), value, country: z.enum(ID_COUNTRIES, says('country', oneOf(ID_COUNTRIES))),
  }),
  strictFor('saudi_vat', { kind: z.literal('saudi_vat'), value }),
  strictFor('phone', { kind: z.literal('phone'), value, country: country.optional() }),
], { error: `kind must be ${oneOf(KINDS)}.` })

function run(i: z.infer<typeof input>): CallToolResult {
  switch (i.kind) {
    case 'iban': return result(parseIban(i.value, i.country ? { country: i.country } : {}))
    case 'emirates_id': return result(parseEmiratesId(i.value))
    case 'national_id': return result(parseNationalId(i.value, i.country))
    case 'saudi_vat': return result(parseSaudiVatNumber(i.value))
    case 'phone': return result(i.country ? PHONES[i.country].parse(i.value) : parseGulfPhone(i.value))
  }
}

export function registerValidate(server: McpServer): void {
  server.registerTool('validate', {
    title: 'Validate Gulf identifiers',
    description: 'Checks a Gulf IBAN, national ID (Emirates ID, Saudi ID or Iqama, Kuwait Civil ID, Qatar QID, Bahrain CPR; Oman not yet), Saudi VAT number or GCC phone number with @dualkit/format, and returns its result unchanged: { ok: true, value } or { ok: false, error: { code, message } }. An invalid value is a normal result, not a tool error; the code is stable, so map it to your own copy. A national_id result has strength checksum or shape: Qatar and Bahrain publish no check digit, so shape means the number only looks right.',
    inputSchema: lenient({
      kind: z.enum(KINDS).describe(`${oneOf(KINDS)}.`),
      value,
      country: country.optional(),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, handle(input, run))
}
