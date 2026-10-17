# Dualkit check action

Checks a page for Arabic and right-to-left bugs on every pull request. It scores the page out of 100, writes the score and the rules that fired to the job summary, uploads the full report as an artifact and, on pull requests, comments the score.

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
| `url` | required | The URL or local HTML file to check. |
| `min-score` | `0` | Fail the job when the score is below this. |
| `width` | `1280` | Viewport width in pixels. |
| `config` | none | Path to a `dualkit.config.json` with rules to ignore and regions to exclude. |
| `comment` | `true` | Comment the score on the pull request. Set it to `false` to only write the job summary. |
| `command` | `npx --yes dualkit@beta` | How to run the CLI. Point it at a local build to test changes to Dualkit itself. |
| `github-token` | `github.token` | The token used for the pull request comment. |

## Outputs

| Output | What it holds |
| --- | --- |
| `score` | The score out of 100. |

## What it sets up

The action installs Node 22 in the job with `actions/setup-node`, then Chromium through Playwright 1.55.0. Each run adds about a minute for the browser download.

## Permissions

Commenting needs `pull-requests: write`. Without it the check still runs, writes the job summary and uploads the report, and the comment step logs that it could not post. On a later push the action edits its last comment instead of adding a new one.

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
