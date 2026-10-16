# Dualkit skills

Four agent skills for building bilingual Arabic and English products for the Gulf. They load on their own when a task calls for them.

| Skill | What it covers |
| --- | --- |
| `dualkit-rtl-layout` | Mirroring, icons, phone numbers and codes inside Arabic text, input direction, Tailwind and CSS logical properties, bidi bugs |
| `dualkit-type-pairing` | Arabic and Latin font stacks, Arabic size and line height, letter-spacing, bold and italic Arabic |
| `dualkit-gulf-formats` | All six Gulf currencies, Arabic-Indic digits, Hijri dates, UAE and Saudi phones, Emirates ID, IBAN, weekends |
| `dualkit-bilingual-copy` | Plurals, interpolation, gendered Arabic, punctuation, language switchers, translation files |

## Install

In Claude Code:

```
/plugin marketplace add dualkit/dualkit
/plugin install dualkit@dualkit
```

The skills are instructions only. They run no code, make no network requests and read no credentials.

The formatting library they point to is [`@dualkit/format`](https://www.npmjs.com/package/@dualkit/format). More at [dualkit.dev](https://dualkit.dev). MIT licensed.
