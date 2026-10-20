# dualkit

Check any screen for Arabic and right-to-left bugs, and get a shareable Gulf-ready report.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/dualkit/dualkit/main/.github/assets/check-report-dark.png">
  <img src="https://raw.githubusercontent.com/dualkit/dualkit/main/.github/assets/check-report.png" alt="A Dualkit check report for an Arabic checkout. It scores 0 out of 100, with 11 problems split across bidi, layout, icons, type and content, and evidence cards that ring an order code and a phone number that will render out of order." width="100%">
</picture>

```sh
npx playwright@1.55.0 install chromium   # once
npx dualkit check https://example.com/ar
```

It opens the page in Chromium, runs 29 rules (bidi, layout, icons, type, content), prints a summary and writes `dualkit-report.html` with a score out of 100 and every issue marked on a screenshot.

| Option | Default | |
| --- | --- | --- |
| `--out <file>` | `dualkit-report.html` | Where the report goes |
| `--json` | | Print the result as JSON |
| `--width`, `--height` | `1280`, `800` | Viewport, for example `--width 390 --height 844` for a phone |
| `--min-score <n>` | `0` | Exit 1 below this score, for CI |
| `--config <file>` | `dualkit.config.json` | Ignore rules or regions |

```json
{ "ignore": ["type/arabic-size"], "exclude": [".third-party-widget"] }
```

Every rule, why it matters and how to fix it: [RULES.md](https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md). Exit codes: 0 done, 1 below `--min-score`, 2 a problem with the input, the browser or the page (including a page that answers with an error status such as 404).

In CI, `uses: dualkit/dualkit/action@main` runs the same check on every pull request: [action/README.md](https://github.com/dualkit/dualkit/blob/main/action/README.md).
