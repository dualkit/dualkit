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

It opens the page in Chromium, runs 34 rules (bidi, layout, icons, type, content), prints a summary and writes `dualkit-report.html` with a score out of 100 and every issue marked on a screenshot.

| Option | Default | |
| --- | --- | --- |
| `--out <file>` | `dualkit-report.html` | Where the report goes |
| `--json` | | Print the result as JSON |
| `--width`, `--height` | `1280`, `800` | Viewport, for example `--width 390 --height 844` for a phone |
| `--min-score <n>` | `0` | Exit 1 below this score, for CI |
| `--config <file>` | `dualkit.config.json` | Ignore rules or regions |
| `--review` | | Experimental. Also ask a vision model for problems the rules cannot see, see [Review](#review) |
| `--review-model <provider:model>` | `gemini:gemini-flash-lite-latest` | The model for `--review` |

```json
{ "ignore": ["type/arabic-size"], "exclude": [".third-party-widget"] }
```

Every rule, why it matters and how to fix it: [RULES.md](https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md). Exit codes: 0 done, 1 below `--min-score`, 2 a problem with the input, the browser or the page (including a page that answers with an error status such as 404).

## Review

```sh
GEMINI_API_KEY=your-key npx dualkit check https://example.com/ar --review
```

`--review` is experimental. It has not been measured against hand labels yet, so treat its findings as suggestions. It adds a second pass after the rules. It sends screenshots of the page to a vision model and asks about problems a rule cannot measure, such as a date that reads in the wrong order or an icon that points the wrong way. Each problem it reports is then checked a second time on a close-up crop, and only the ones the model confirms firmly are kept.

By default it uses `gemini-flash-lite-latest` from Google, which has a free tier. Pick another model with `--review-model provider:model`, where the provider is `gemini` or `openrouter`, for example `--review-model openrouter:google/gemma-3-27b-it:free`.

The keys are read from your environment: `GEMINI_API_KEY` for Gemini and `OPENROUTER_API_KEY` for OpenRouter. The run uses your own key and your bill. The $3 a month cap on model spend applies only to Dualkit's own measurement runs, not to yours. The summary and the `--json` output say how much it spent, but Gemini reports no cost, so spend on a billing-enabled Gemini key is not counted. Without a key, the check runs as normal and one line says that review was skipped.

Review findings are warnings. They are marked `review`, they carry a confidence from 0 to 1, and they point at a source line when you check a local file. They never change the score or the exit code, and they never replace or remove a finding from the rules.

The model can be wrong. It can miss a real problem, and it can report one that is not there, so treat each finding as a prompt to look, not a verdict. Pages taller than four screens are only reviewed down to the fourth, and the run says so.

## Lint your source

```sh
npx dualkit@beta lint .
```

`dualkit lint [paths...]` scans CSS, SCSS, HTML, Vue, Svelte, JavaScript and TypeScript against the 8 source rules that run by default, without launching a browser. Paths default to the current folder, and a folder walk skips what your `.gitignore` skips.

```
physical.css:2:3  · source/physical-css  `margin-left: 8px` is tied to one side. Use `margin-inline-start`.

0 errors, 0 warnings, 1 note in 2 files
```

| Option | Default | |
| --- | --- | --- |
| `--json` | | Print the result as JSON |
| `--fail-on <level>` | `error` | Exit 1 on findings at or above `error`, `warning` or `note` |
| `--config <file>` | `dualkit.config.json` | The same `ignore` list; it accepts lint rule ids too |

Exit codes: 0 clean, 1 a finding at or above `--fail-on`, 2 a problem with the input. The lint rules live in [@dualkit/lint](https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md), which is published before the CLI.

In CI, `uses: dualkit/dualkit/action@main` with `mode: lint` runs it on every pull request: [action/README.md](https://github.com/dualkit/dualkit/blob/main/action/README.md).

## Convert an app

```sh
npx dualkit@beta convert --mode bilingual --start "npm run dev" --port 3000
```

`dualkit convert` turns an English Next.js App Router or Vite React app into an Arabic one on a new git branch, `dualkit/bilingual` or `dualkit/arabic`. It needs a clean working tree, never pushes and makes no model calls. `bilingual` keeps English exactly as it is and adds Arabic with a switch. `arabic` makes the whole app Arabic and right to left, in place.

```
Branch: dualkit/bilingual
22 files changed, 52 edits, 10 strings to translate, 3 places left for you.
```

Fill the Arabic in `dualkit-strings.json`, or ask your agent to use the dualkit-convert skill. Then run:

```sh
npx dualkit@beta convert --finish
```

Finish compares each English page with its screenshot from before the conversion, runs the check rules on each Arabic page and writes `dualkit-convert.md`.

| Option | Default | |
| --- | --- | --- |
| `--mode <mode>` | | `bilingual` or `arabic`. Asked for on a terminal when left out |
| `--finish` | | Run phase 2 and write the report |
| `--force` | | With `--finish`, use English for strings with no Arabic yet |
| `--start <cmd>` | | The command that starts your app, saved under `convert` in the config file |
| `--port <n>` | | The port it listens on, saved with the start command |
| `--no-install` | | Do not install next-intl or react-i18next |
| `--no-baseline` | | Skip the English screenshots, so English is not proven unchanged |
| `--config <file>` | `dualkit.config.json` | The `convert` block also takes `test`, `routes`, `params` and `storageState` |

Exit codes: 0 phase 1 done or finish passed, 1 finish failed, 2 refused or a problem with the input, 130 interrupted. What it converts, what it flags and the config block in full: [@dualkit/convert](https://github.com/dualkit/dualkit/blob/main/packages/convert/README.md).
