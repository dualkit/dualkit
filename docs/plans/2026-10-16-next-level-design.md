# Dualkit, the next level

Agreed with Sam on 16 Oct 2026. Dualkit grows from a toolkit for people coding with agents into a small hub for GCC product designers who use AI and care about design systems. Everything stays free to use and free to run.

## Decisions

- **Audiences:** product designers in Figma and design system teams in code, served by one shared rules engine.
- **Order:** engine first, then `dualkit check` and its report, then the Bench, the hub pages, samples, and the Figma plugin.
- **The Bench uses free models only** (Gemini free tier, OpenRouter free models). It is automated on GitHub Actions and costs nothing.
- **Arabic authority comes from native co-authors.** Sam leads the systems, the craft and the evidence; native Arabic designers write or sign off every language decision, credited by name. Co-authors are recruited through the community.
- **Waiting on co-authors:** Gulf UI strings and the script-aware token standard.
- **Parked:** making Dualkit the default Arabic layer inside v0, Lovable or Bolt, and an MCP server.
- **The hub keeps the site rules:** no location anywhere, the maker credit stays quiet, and no claims beyond the evidence.

## 1. The engine: `@dualkit/rules`

Each rule is a small function with a stable id, a severity (error, warning, note), one plain sentence of fix, and a link to its pattern page. Rules read a normalized screen model (text runs with direction and language, fonts, letter spacing, line height, layout direction, icon names), so the same rule runs on two readers: the browser DOM and Figma layers.

The first 20 rules, in five groups:

- **bidi:** unisolated numbers, codes, emails and URLs inside Arabic; trailing punctuation in mixed lines.
- **layout:** physical properties (`left`, `margin-right`); `text-align: left` in RTL; fixed-direction flex and grid.
- **icons:** directional icons that do not mirror; icons that mirror but must not (play, check, logos).
- **type:** tight Arabic leading; letter-spacing on Arabic; synthetic bold or italic on Arabic; Arabic set in a Latin-only font.
- **content:** mixed digit systems on one screen; missing `lang` or `dir`; visible dates with no time zone.

Every rule ships with good and bad fixtures, written first. A rule ships only when it catches the bad one and stays quiet on the good one.

## 2. `dualkit check` and the Gulf-ready report

```
npx dualkit check https://example.com/ar
```

Opens the page in a headless browser, runs every rule, prints a grouped summary and writes `dualkit-report.html`: a score out of 100, issues grouped by rule, each marked on a screenshot, each with its fix and a pattern link. A config file can ignore a rule or a region. A GitHub Action runs the same command and comments the score on pull requests.

Not in v1: a paste-a-URL checker on the website, because running browsers on a server costs money.

## 3. The Bench (`/bench`)

- Five published prompts: payment summary, OTP verification, address form, profile with phone and IBAN, order history with dates. Each asks for one Arabic HTML file.
- Monthly on the 1st, plus a manual run: each free model builds each screen three times at a fixed temperature, then again with the Dualkit skills loaded. `dualkit check` scores every render; the median counts.
- Results, raw outputs and screenshots are committed as JSON and images, so anyone can check them.
- The page shows each model's score alone, with Dualkit, and the lift, with drill-down to annotated screens and a "how it works" section that states it is a small free-model sample.
- A model that fails or disappears shows as "didn't run this month", never a guessed score.
- Two free API keys (Gemini, OpenRouter) are GitHub secrets, created once by Sam.

## 4. The hub pages

- **`/gallery`:** about 24 entries of Arabic UI done well from regional banking, payments, delivery, government and travel products. Each has a screenshot and two or three notes on layout and mechanics. Praise only; bad examples appear only as anonymous mock-ups on pattern pages, because the named companies are potential employers. Notes never judge the quality of the Arabic writing.
- **`/patterns`:** eight to start, matching the Starter (payment summary, OTP, amount, date with Hijri, phone and IBAN fields, tabs, sheet, toast). Each shows the broken and fixed versions live, the rule, the Figma frame and the shadcn install. Report findings link here.
- **`/resources`:** about 40 opinionated entries across Arabic fonts (licence and pairing notes), mirroring icon sets, Figma plugins, AI tools tested on Arabic, and reading. One line each on why. Suggestions arrive through the feedback button.
- **Monthly note:** on `/updates` and its RSS, tagged Note: Bench movers, one gallery teardown, new rules and patterns. Sam posts it via Typefully. No email list until people ask for one.
- **Content lives in typed data files in the repo**, like `updates.ts`. No CMS, no running cost.

## 5. Samples, the Figma plugin and co-authors

- **`@dualkit/samples`:** seeded, repeatable bilingual data: names by gender (Arabic script and English spelling), UAE and Saudi addresses, amounts in six currencies, phones, and IBANs and Emirates IDs that pass validation through `@dualkit/format`, plus Hijri and Gregorian dates. Arabic name spellings are beta until a co-author checks them.
- **Figma plugin**, free on Figma Community: check a frame against the shared rules (click to jump to the layer); mirror a frame (reverse auto layout, swap directional icons by name, leave play, check and logos alone); apply Arabic type pairing and leading; fill placeholder text with Gulf samples.
- **Co-author track from day one:** a "Help write Arabic" page and GitHub issue saying what is needed, how long it takes and how people are credited. A `/people` page and release notes credit contributors. Strings and the standard start once two or three people have joined.

## Timing

At 5 to 8 hours a week: engine and check about 3 weeks, Bench about 1, hub pages about 2, samples about 1, Figma plugin about 3.

## Risks

- **False positives in rules.** Mitigated by fixtures, severities and the ignore config.
- **Free model churn and rate limits.** Shown honestly as "didn't run".
- **Authority on Arabic.** Never claimed by Sam alone; co-authors sign off language.
- **Employer exposure.** Gallery praises only; no location on the site.
