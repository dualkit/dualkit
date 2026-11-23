// The sample kinds, apart from the generator so the main thread can validate messages without bundling @dualkit/format.

export const SAMPLE_KINDS = [
  'phone-ae', 'phone-sa', 'iban-ae', 'iban-sa', 'emirates-id', 'national-id-sa', 'national-id-kw', 'national-id-qa', 'national-id-bh',
  'amount-aed', 'amount-sar', 'amount-kwd', 'date-gregorian', 'date-hijri',
] as const
export type SampleKind = (typeof SAMPLE_KINDS)[number]

export const isSampleKind = (v: unknown): v is SampleKind => typeof v === 'string' && (SAMPLE_KINDS as readonly string[]).includes(v)
