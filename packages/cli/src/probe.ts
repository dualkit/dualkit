import type { Frame, Locator, Page } from 'playwright'

// Only Playwright types are imported here, so the rules package's fixture test can run this same probe on its pages.

/** The kinds of field an Arabic reader types digits into. */
const PROBED_KINDS = new Set(['code', 'tel', 'number'])
export const PROBE_MAX_FIELDS = 8
/** Per step: a slow, detached or covered field gives up quickly instead of stalling the audit. */
const STEP_TIMEOUT_MS = 1000
const ARABIC = '١٢'
const WESTERN = '12'

type ProbeField = { id: string; kind: string }

/**
 * Kept when the value holds ١٢ or 12. A field with a maxlength keeps only that many characters, so the test is cut
 * to the same length: a one-character code box that keeps ١ passes.
 */
function keptDigits(value: string, maxLength: number): boolean {
  const cut = (s: string) => (maxLength > 0 ? s.slice(0, maxLength) : s)
  return value.includes(cut(ARABIC)) || value.includes(cut(WESTERN))
}

/** True when typing ١٢ was deleted, false when it survived, null when the field could not be typed into. */
async function probeOne(field: Locator): Promise<boolean | null> {
  const timeout = STEP_TIMEOUT_MS
  try {
    if (!(await field.isEditable({ timeout }))) return null
    const original = await field.inputValue({ timeout })
    const maxLength = await field.evaluate((el) => (el as unknown as { maxLength: number }).maxLength, undefined, { timeout })
    await field.fill(ARABIC, { timeout })
    const typed = await field.inputValue({ timeout })
    // Set directly, with no input event: the page's own handler would strip an Arabic original all over again.
    await field.evaluate((el, value) => { (el as unknown as { value: string }).value = value }, original, { timeout }).catch(() => {})
    return !keptDigits(typed, maxLength)
  } catch {
    return null
  }
}

/**
 * Types ١٢ into up to PROBE_MAX_FIELDS code, tel and number fields and reports, by field id, whether the digits were
 * deleted. It never presses Enter or submits, and puts each field's value back afterwards. A field it cannot type into
 * is left out. If typing navigates the page, it stops there and leaves the remaining fields out. Never throws.
 */
export async function probeArabicDigits(page: Page, fields: readonly ProbeField[]): Promise<Map<string, boolean>> {
  const found = new Map<string, boolean>()
  let navigated = false
  const onNavigate = (frame: Frame) => { if (frame === page.mainFrame()) navigated = true }
  page.on('framenavigated', onNavigate)
  try {
    for (const field of fields.filter((f) => PROBED_KINDS.has(f.kind)).slice(0, PROBE_MAX_FIELDS)) {
      const dropped = await probeOne(page.locator(`css=${field.id}`))
      // A result read after a navigation may come from another page, so it is not kept.
      if (navigated) break
      if (dropped !== null) found.set(field.id, dropped)
    }
  } finally {
    page.off('framenavigated', onNavigate)
  }
  return found
}

/** A copy of the fields with dropsArabicDigits set from the probe; a field the probe left out stays null. */
export function markDroppedDigits<F extends { id: string; dropsArabicDigits: boolean | null }>(fields: readonly F[], probed: ReadonlyMap<string, boolean>): F[] {
  return fields.map((f) => ({ ...f, dropsArabicDigits: probed.get(f.id) ?? null }))
}
