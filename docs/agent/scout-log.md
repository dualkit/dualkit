# Scout log

## 15 November 2026

Nothing worth adopting this week.

- Gulf currency signs: Unicode 17 added the Saudi riyal sign (U+20C1). The Unicode blog says the UAE dirham sign (U+20C3) and Omani rial sign (U+20C4) are in Unicode 18, due September 2026. `packages/format/src/currency-sign.ts` already maps all three. A later CLDR release is expected to make the Saudi riyal sign the default symbol. Revisit when CLDR ships it, because ICU comparison tests in the format package may then change.
- libphonenumber-js: the 1.13.x changelog showed no Gulf region changes in the snippets found. Not verified against the upstream changelog, so recheck next week.
- Dependencies: `npm outdated` returned nothing, but no install was present in this checkout, so that result is weak. Run it after `npm ci` next time.
- No new open-source candidates were tested this week.
