# Dualkit action

Two modes. `check` (the default) checks a page for Arabic and right-to-left bugs on every pull request. It scores the page out of 100, writes the score and the rules that fired to the job summary, uploads the full report as an artifact and, on pull requests, comments the score. `lint` scans your source files for Arabic and right-to-left bugs without a browser; see [Linting source files](#linting-source-files).

```yaml
name: Dualkit
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dualkit/dualkit/action@main
        with:
          url: https://example.com/ar
          min-score: 80
```

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `mode` | `check` | `check` audits a rendered page. `lint` scans source files and needs no browser. |
| `url` | none | The URL or local HTML file to check. Required when `mode` is `check`; the action exits 2 without it. |
| `paths` | `.` | Space-separated files or folders to lint. Used only when `mode` is `lint`. |
| `fail-on` | `error` | Lowest severity that fails the job: `error`, `warning` or `note`. Used only when `mode` is `lint`. |
| `min-score` | `0` | Fail the job when the score is below this. |
| `width` | `1280` | Viewport width in pixels. |
| `config` | none | Path to a `dualkit.config.json` with rules to ignore and regions to exclude. |
| `comment` | `true` | Comment the score on the pull request. Set it to `false` to only write the job summary. |
| `command` | `npx --yes dualkit@beta` | How to run the CLI. Point it at a local build to test changes to Dualkit itself. |
| `github-token` | `github.token` | The token used for the pull request comment. |

## Outputs

| Output | What it holds |
| --- | --- |
| `score` | The score out of 100 (check mode). |
| `findings` | The number of lint findings (lint mode). |

## What it sets up

The action installs Node 22 in the job with `actions/setup-node`, then Chromium through Playwright 1.55.0. Each run adds about a minute for the browser download.

## Permissions

Commenting needs `pull-requests: write`. Without it the check still runs, writes the job summary and uploads the report, and the comment step logs that it could not post. On a later push the action edits its earlier comment instead of adding a new one. Check and lint each keep their own comment, marked with a hidden `<!-- dualkit:check -->` or `<!-- dualkit:lint -->` line, so a workflow that runs both never overwrites one with the other.

## Checking a preview deployment

Most pull requests are best checked against their preview URL. With a host that reports deployments to GitHub, run on `deployment_status` and pass the URL it reports:

```yaml
name: Dualkit preview
on: deployment_status
jobs:
  check:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: dualkit/dualkit/action@main
        with:
          url: ${{ github.event.deployment_status.target_url }}
          min-score: 80
```

A `deployment_status` run is not a pull request event, so the score goes to the job summary and the report artifact, not a comment.

## Linting source files

Lint mode reads your CSS, SCSS, HTML, JavaScript and TypeScript files, so it runs in seconds and skips the Chromium download and the report artifact. The job summary lists the totals and a count per rule, and on pull requests the action comments the same text. It fails the job when a finding reaches `fail-on`.

```yaml
name: Dualkit lint
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dualkit/dualkit/action@main
        with:
          mode: lint
          paths: src styles
          fail-on: warning
```
