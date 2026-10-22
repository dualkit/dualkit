import { existsSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { RUN, type Screen } from './config'
import { missingParts } from './score'
import type { BuildRecord, Store } from './store'

const GOTO_MS = 30_000
const SETTLE_MS = 800

/** Renders a stored page and returns the required parts it leaves out. */
async function partsOf(browser: Browser, file: string, screen: Screen): Promise<string[]> {
  const context = await browser.newContext({ viewport: { width: RUN.width, height: RUN.height } })
  try {
    const page = await context.newPage()
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: GOTO_MS })
    await page.waitForTimeout(SETTLE_MS)
    return await missingParts(page, screen.required)
  } finally {
    await context.close().catch(() => {})
  }
}

const lost = (before: string[], after: string[]) => after.filter((p) => !before.includes(p))

/**
 * Checks the required parts again on every stored page of a month, after a change to a screen's checks.
 * Nothing is generated and the rule findings are kept: only `missing`, and each loop round's `missing` and `lostParts`, change.
 */
export async function rescoreParts(month: string, screens: Screen[], store: Store, log: (line: string) => void = () => {}): Promise<number> {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const browser = await chromium.launch()
  let changed = 0
  try {
    const records = store.list(month).filter((r) => r.ok)
    // Loop records read their dualkit page's parts, so the other setups go first.
    const ordered = [...records.filter((r) => r.condition !== 'loop'), ...records.filter((r) => r.condition === 'loop')]
    const fresh = new Map<string, string[]>()
    const keyOf = (r: BuildRecord) => `${r.model}/${r.screen}/${r.run}`
    for (const rec of ordered) {
      const screen = byId.get(rec.screen)
      const html = store.paths(rec).html
      if (!rec.ok || !screen || !existsSync(html)) continue
      const next: BuildRecord = { ...rec, missing: await partsOf(browser, html, screen) }
      if (next.ok && rec.condition === 'loop' && next.rounds) {
        let before = fresh.get(`dualkit/${keyOf(rec)}`) ?? []
        const rounds = []
        for (const [i, round] of next.rounds.entries()) {
          const page = store.roundPaths(rec, i + 1).html
          if (!round.ok || !existsSync(page)) { rounds.push(round); continue }
          const missing = await partsOf(browser, page, screen)
          rounds.push({ ...round, missing, lostParts: lost(before, missing) })
          before = missing
        }
        next.rounds = rounds
      }
      if (next.ok) fresh.set(`${rec.condition}/${keyOf(rec)}`, next.missing)
      if (JSON.stringify(next) !== JSON.stringify(rec)) {
        writeFileSync(store.paths(rec).json, `${JSON.stringify(next, null, 2)}\n`)
        changed++
        log(`${rec.model} ${rec.screen} ${rec.condition}-${rec.run}: missing ${rec.ok ? rec.missing.join(', ') || 'none' : ''} -> ${next.ok ? next.missing.join(', ') || 'none' : ''}`)
      }
    }
  } finally {
    await browser.close()
  }
  return changed
}
