# Dualkit

Build for the Gulf. In both directions.

Dualkit is a free, open-source toolkit for products that ship in Arabic and English. **v0.1 is in beta.**

| Part | What it is | Install |
| --- | --- | --- |
| [Skills](skills/) | Four agent skills for Claude Code and Cursor: RTL layout, Arabic and Latin type pairing, Gulf formats and bilingual copy | `/plugin marketplace add dualkit/dualkit` |
| [Format](packages/format/) | `@dualkit/format`: AED and SAR, Umm al-Qura dates, Arabic numerals, UAE phone, Emirates ID and Gulf IBAN. No dependencies | `npm i @dualkit/format` |
| Starter | A bilingual design system template: tokens in git, a generated Figma library and AGENTS.md | Coming next |

Docs and live demos are at [dualkit.dev](https://dualkit.dev).

## Skills

In Claude Code:

```
/plugin marketplace add dualkit/dualkit
/plugin install dualkit@dualkit
```

In Cursor, copy [`cursor/rules`](cursor/rules/) into your project's `.cursor/rules`. The rules are generated from the same source as the skills, and CI fails if they drift.

The skills were measured against a baseline before release. Fresh agents built the same bilingual checkout screen three times without them and three times with them. The task, the scorer and every run are in [`evals/payment-summary`](evals/payment-summary/RESULTS.md).

## Format

```ts
import { formatMoney, formatHijri, parseUaePhone } from '@dualkit/format'

formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' }) // ١٬٢٣٤٫٥٠ د.إ
formatHijri(new Date('2026-02-18'), { timeZone: 'Asia/Riyadh' })          // 1 Ramadan 1447 AH
parseUaePhone('٠٥٠ ١٢٣ ٤٥٦٧')                                            // { ok: true, value: { e164: '+971501234567', type: 'mobile' } }
```

See [the package README](packages/format/README.md) for the full API.

## Repo

| Path | Contents |
| --- | --- |
| `packages/format` | The format library, with its tests |
| `skills` | The four skills (`SKILL.md` each) |
| `cursor/rules` | Cursor rules generated from `skills` |
| `packages/skills` | The generator and the tests that keep skills, rules and the plugin manifest in step |
| `apps/site` | dualkit.dev (Next.js) |
| `design` | Figma specs, tokens and the motion prototype the site was built from |
| `evals` | Baseline evaluations for the skills |

```
npm install
npm test
npm run dev
```

## Status

This is a beta. No native Arabic reviewer has checked the Arabic rules yet; that happens before 1.0. If any Arabic reads wrong, please [open an issue](https://github.com/dualkit/dualkit/issues).

Made by [Sam Santos](https://snts.im). MIT licensed.
