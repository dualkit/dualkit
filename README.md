<p align="center">
  <a href="https://dualkit.dev"><img src=".github/assets/banner.png" alt="Dualkit. Build for the Gulf. In both directions." width="100%"></a>
</p>

<p align="center">
  <a href="https://dualkit.dev"><img src=".github/assets/btn-website.svg" alt="dualkit.dev" height="40"></a>&nbsp;
  <a href="https://dualkit.dev/docs"><img src=".github/assets/btn-docs.svg" alt="Docs" height="40"></a>&nbsp;
  <a href="#skills"><img src=".github/assets/btn-skills.svg" alt="Install the skills" height="40"></a>&nbsp;
  <a href="https://github.com/dualkit/dualkit/releases"><img src=".github/assets/btn-releases.svg" alt="Releases" height="40"></a>
</p>

<p align="center">Free, open-source tools for products that ship in Arabic and English. <b>v0.1 beta.</b></p>

## The problem

Ask Claude Code or Cursor for a bilingual screen and you get the same three bugs:

- A UAE phone number inside Arabic text renders backwards.
- A Hijri date comes out a day wrong near midnight.
- A code typed in Arabic digits fails validation.

Dualkit fixes them at the source, in the agent and in the code.

| | What it is | Install |
| --- | --- | --- |
| **[Skills](skills/)** | Four agent skills for Claude Code and Cursor: RTL layout, Arabic and Latin type pairing, Gulf formats, bilingual copy | `/plugin marketplace add dualkit/dualkit` |
| **[Format](packages/format/)** | AED and SAR, Umm al-Qura dates, Arabic numerals, UAE phone, Emirates ID, Gulf IBAN. No dependencies | [From the release](#format), npm soon |
| **[Starter](packages/starter/)** | A bilingual design system to fork: one token file feeds CSS, Tailwind and Figma, plus eight React components | [From the release](#starter) |

## Proof

Fresh agents built the same bilingual checkout three times without the skills and three times with them.

| Check | Without | With |
| --- | --- | --- |
| Phone and IBAN isolated inside Arabic text | 0/3 | 3/3 |
| Arabic type overrides (line height, size, tracking) | 0/3 | 3/3 |
| Digit system pinned, not left to defaults | 1/3 | 3/3 |

Three runs is a smoke test, not a benchmark. The task, the scorer and every run are in [`evals/payment-summary`](evals/payment-summary/RESULTS.md).

## Skills

In Claude Code:

```
/plugin marketplace add dualkit/dualkit
/plugin install dualkit@dualkit
```

In Cursor, copy [`cursor/rules`](cursor/rules/) into your project's `.cursor/rules`. The rules are generated from the same source as the skills, and CI fails if they drift.

## Format

Until it lands on npm, install it from the release:

```
npm i https://github.com/dualkit/dualkit/releases/download/format-v0.1.0-beta.0/dualkit-format-0.1.0-beta.0.tgz
```

```ts
import { formatMoney, formatHijri, parseUaePhone } from '@dualkit/format'

formatMoney(1234.5, { currency: 'AED', locale: 'ar', numerals: 'arab' }) // ١٬٢٣٤٫٥٠ د.إ
formatHijri(new Date('2026-02-18'), { timeZone: 'Asia/Riyadh' })          // 1 Ramadan 1447 AH
parseUaePhone('٠٥٠ ١٢٣ ٤٥٦٧')                                            // { ok: true, value: { e164: '+971501234567', type: 'mobile' } }
```

Full API in [the package README](packages/format/README.md).

## Starter

```
npm i https://github.com/dualkit/dualkit/releases/download/starter-v0.1.0-beta.0/dualkit-starter-0.1.0-beta.0.tgz
```

Then in your CSS:

```css
@import '@dualkit/starter/tokens.css';
@import 'tailwindcss';
@import '@dualkit/starter/theme.css';
```

`<html lang="ar" dir="rtl">` switches to Arabic type, and `data-theme="dark"` to dark mode. More in [the starter README](packages/starter/README.md).

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
