# @dualkit/mcp

An MCP server that gives your coding agent Dualkit's Gulf formats, validators and Arabic and right-to-left rules. It runs on your machine over stdio, needs no browser and makes no network calls.

## Install

Claude Code:

```sh
claude mcp add dualkit -- npx -y @dualkit/mcp
```

Cursor, in `.cursor/mcp.json` for one project or `~/.cursor/mcp.json` for all of them:

```json
{
  "mcpServers": {
    "dualkit": { "command": "npx", "args": ["-y", "@dualkit/mcp"] }
  }
}
```

Codex:

```sh
codex mcp add dualkit -- npx -y @dualkit/mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.dualkit]
command = "npx"
args = ["-y", "@dualkit/mcp"]
```

It needs Node 20.19 or later.

## Tools

### `format`

Formats a value with [`@dualkit/format`](../format/). Set `kind` to `money`, `hijri`, `numerals` or `phone`.

```json
{ "kind": "money", "amount": 1234.5, "currency": "KWD", "locale": "ar", "numerals": "arab" }
→ { "text": "١٬٢٣٤٫٥٠٠ د.ك" }

{ "kind": "hijri", "date": "2026-02-18T12:00:00Z", "timeZone": "Asia/Riyadh" }
→ { "text": "1 Ramadan 1447 AH", "hijri": { "year": 1447, "month": 9, "day": 1 } }

{ "kind": "phone", "text": "+971 50 123 4567", "style": "international" }
→ { "text": "+971 50 123 4567", "country": "AE" }
```

A Hijri date needs `timeZone`, because the day changes at local midnight.

### `validate`

Checks an IBAN, Emirates ID, Saudi VAT number or GCC phone number, and returns format's result unchanged. An invalid value is a normal result, not an error, and the `code` is stable, so you can map it to your own Arabic and English copy.

```json
{ "kind": "iban", "value": "AE07 0331 2345 6789 0123 457" }
→ { "ok": false, "error": { "code": "invalid_checksum", "message": "This IBAN is not valid. Check for a typo." } }
```

### `rules`

Lists the 34 rules that `dualkit check` runs, with each one's severity, fix and docs link. Pass `id` to read one, with why it matters.

### `check_html`

Runs the rules on an HTML string in jsdom. Scripts do not run and nothing is fetched. Input is capped at 512 KB, and a check that runs longer than 10 seconds is stopped with a plain error. Each check runs in its own worker thread, so the server keeps answering other calls meanwhile.

```json
{ "html": "<html lang=\"ar\" dir=\"rtl\"><body><p>اتصل على <span>050 123 4567</span></p></body></html>" }
→ {
  "findings": [{ "rule": "bidi/unisolated-number", "severity": "error", "message": "\"050 123 4567\" is not isolated, so its groups can show in reverse order.", "fix": "Wrap the number in <bdi>, or give its element dir=\"ltr\".", "node": { "id": "body > p > span", "snippet": "<span>050 123 4567</span>" }, ... }],
  "checked": ["bidi/unisolated-number", ...],
  "notChecked": [{ "rule": "layout/clipped-text", "reason": "It measures rendered boxes, and jsdom does no layout. Run npx dualkit check on the page to include it." }, ...]
}
```

jsdom has no layout, fonts or computed transforms, so 16 rules run and 18 are listed under `notChecked` with the reason: clipped text, line height, font loading, mirrored icons and the like. To run all 34, point [`dualkit check`](../cli/) at the page in a browser.

## Errors

Bad input comes back as a tool error in one plain sentence, such as `Add timeZone: an IANA time zone, such as Asia/Dubai.`

## In your own code

```ts
import { createServer } from '@dualkit/mcp'

await createServer().connect(transport)
```

MIT licensed. Part of [Dualkit](https://dualkit.dev).
