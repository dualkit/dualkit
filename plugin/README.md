# Dualkit skills

Four agent skills for building bilingual Arabic and English products for the Gulf. They load on their own when a task calls for them.

| Skill | What it covers |
| --- | --- |
| `dualkit-rtl-layout` | Mirroring, icons, phone numbers and codes inside Arabic text, input direction, punctuation and brackets, CSS logical properties first and Tailwind last, bidi bugs |
| `dualkit-type-pairing` | Arabic and Latin font stacks, Arabic size floor, line height, letter-spacing, bold and italic Arabic, Arabic inside Latin text |
| `dualkit-gulf-formats` | All six Gulf currencies, Arabic-Indic digits, currency signs, Hijri dates, phones and IBANs for all six GCC countries, Emirates ID, Saudi VAT number, weekends |
| `dualkit-bilingual-copy` | Plurals, interpolation, gendered Arabic, punctuation, stacked two-language labels, language switchers, translation files |

## Install

Dualkit is listed in the Claude plugin directory, so you can install it from there in Claude Code, Cowork and the Claude apps. Or, in Claude Code:

```
/plugin marketplace add dualkit/dualkit
/plugin install dualkit@dualkit
```

The skills are instructions only. They run no code, make no network requests and read no credentials.

The formatting library they point to is [`@dualkit/format`](https://www.npmjs.com/package/@dualkit/format). More at [dualkit.dev](https://dualkit.dev). MIT licensed.
