import { WORKS_WITH } from '../marks'

export const markPath = (name: string) => WORKS_WITH.find((m) => m.name === name)?.path ?? ''

/** What sits inside each footer seal. Only marks whose owners allow this use are logos: the OSI Approved License mark
 *  (opensource.org trademark guidelines: ® kept, linked to opensource.org, attribution in the footer). npm's policy
 *  allows its logos only with written permission, so npm is plain text like the rest. No invented symbols. */
export type SealMark =
  | { kind: 'logo'; src: string; width: number; height: number; href: string; label: string }
  | { kind: 'text'; text: string }

export const OSI_URL = 'https://opensource.org/license/mit'

export const SEAL_MARKS: Record<string, SealMark> = {
  'UAX #9': { kind: 'text', text: 'UAX 9' },
  'ISO 13616': { kind: 'text', text: '13616' },
  'Umm al-Qura': { kind: 'text', text: 'UQ' },
  npm: { kind: 'text', text: 'npm' },
  MIT: { kind: 'logo', src: '/v3/marks/osi-approved.svg', width: 535, height: 698, href: OSI_URL, label: 'MIT is an OSI Approved License (opensource.org)' },
  Native: { kind: 'text', text: 'AR' },
}
