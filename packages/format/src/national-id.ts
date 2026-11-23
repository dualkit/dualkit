import { parseBahrainCpr, type BahrainCpr } from './bahrain-cpr'
import { parseEmiratesId, type EmiratesId } from './emirates-id'
import type { GulfCountry } from './gulf-phone'
import { parseKuwaitCivilId, type KuwaitCivilId } from './kuwait-civil-id'
import { parseQatarId, type QatarId } from './qatar-id'
import { ok, type Result } from './result'
import { parseSaudiId, type SaudiId } from './saudi-id'

/** Oman waits for an official source for its civil number. */
export type NationalIdCountry = Exclude<GulfCountry, 'OM'>
/** `checksum`: the number has a check digit and it matched. `shape`: only the length and fixed digits were checked. */
export type NationalIdStrength = 'checksum' | 'shape'
export type NationalIdError =
  | 'empty' | 'invalid_characters' | 'invalid_length' | 'invalid_prefix' | 'invalid_birth_date' | 'invalid_checksum'

export type NationalId =
  | ({ readonly country: 'AE'; readonly strength: 'checksum' } & EmiratesId)
  | ({ readonly country: 'SA'; readonly strength: 'checksum' } & SaudiId)
  | ({ readonly country: 'KW'; readonly strength: 'checksum' } & KuwaitCivilId)
  | ({ readonly country: 'QA'; readonly strength: 'shape' } & QatarId)
  | ({ readonly country: 'BH'; readonly strength: 'shape' } & BahrainCpr)

export const NATIONAL_ID_COUNTRIES: readonly NationalIdCountry[] = ['AE', 'SA', 'KW', 'QA', 'BH']

export const NATIONAL_ID_LENGTH: Readonly<Record<NationalIdCountry, number>> = { AE: 15, SA: 10, KW: 12, QA: 11, BH: 9 }

/** Synthetic numbers that pass each country's check. For placeholders, demos and tests; none belongs to a person we know of. */
export const NATIONAL_ID_EXAMPLES: Readonly<Record<NationalIdCountry, string>> = {
  AE: '784199012345676',
  SA: '1012345672',
  KW: '290010112346',
  QA: '29063412345',
  BH: '900112345',
}

const tag = <C extends NationalIdCountry, S extends NationalIdStrength, T, E extends string>(
  country: C, strength: S, result: Result<T, E>,
): Result<{ readonly country: C; readonly strength: S } & T, E> =>
  result.ok ? ok({ country, strength, ...result.value }) : result

/** Reads a national ID for one Gulf country. The result says which country and how strong the check was. */
export function parseNationalId(input: string, country: NationalIdCountry): Result<NationalId, NationalIdError> {
  switch (country) {
    case 'AE': return tag('AE', 'checksum', parseEmiratesId(input))
    case 'SA': return tag('SA', 'checksum', parseSaudiId(input))
    case 'KW': return tag('KW', 'checksum', parseKuwaitCivilId(input))
    case 'QA': return tag('QA', 'shape', parseQatarId(input))
    case 'BH': return tag('BH', 'shape', parseBahrainCpr(input))
  }
}

export const isValidNationalId = (input: string, country: NationalIdCountry): boolean => parseNationalId(input, country).ok

export function formatNationalId(input: string, country: NationalIdCountry): string | null {
  const parsed = parseNationalId(input, country)
  return parsed.ok ? parsed.value.formatted : null
}
