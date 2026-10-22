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
    // A selector that matches nothing would otherwise wait out the full timeout.
    if ((await field.count()) === 0) return null
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

/** A field's maxlength (-1 when unset) and its form's index in document.forms (-1 when it has none). Null when not found. */
async function shapeOf(field: Locator): Promise<{ maxLength: number; form: number } | null> {
  try {
    if ((await field.count()) === 0) return null
    return await field.evaluate((el) => {
      const input = el as unknown as { maxLength: number; form: unknown }
      const forms = (globalThis as unknown as { document: { forms: ArrayLike<unknown> } }).document.forms
      return { maxLength: input.maxLength, form: input.form ? Array.from(forms).indexOf(input.form) : -1 }
    }, undefined, { timeout: STEP_TIMEOUT_MS })
  } catch {
    return null
  }
}

/** A one-character box, one of a row that together hold a code. */
const isDigitBox = (maxLength: number): boolean => maxLength >= 0 && maxLength <= 1

/**
 * Types ١٢ into up to PROBE_MAX_FIELDS code, tel and number fields and reports, by field id, whether the digits were
 * deleted. It never presses Enter or submits, and puts each field's value back afterwards. A field it cannot type into
 * is left out. If typing navigates the page, it stops there and leaves the remaining fields out. Never throws.
 *
 * The value is put back with no input event, so a page that keeps each digit in its own state still holds the typed one.
 * To never fill a whole code that such a page then sends, it types into only the first box of a run of one-character
 * code boxes, and into at most one field per form.
 */
export async function probeArabicDigits(page: Page, fields: readonly ProbeField[]): Promise<Map<string, boolean>> {
  const found = new Map<string, boolean>()
  const usedForms = new Set<number>()
  let inDigitRun = false
  let navigated = false
  const onNavigate = (frame: Frame) => { if (frame === page.mainFrame()) navigated = true }
  page.on('framenavigated', onNavigate)
  try {
    for (const field of fields.filter((f) => PROBED_KINDS.has(f.kind)).slice(0, PROBE_MAX_FIELDS)) {
      const locator = page.locator(`css=${field.id}`)
      const shape = await shapeOf(locator)
      if (shape === null) continue
      const digitBox = field.kind === 'code' && isDigitBox(shape.maxLength)
      const skip = (digitBox && inDigitRun) || usedForms.has(shape.form)
      inDigitRun = digitBox
      if (skip) continue
      const dropped = await probeOne(locator)
      // A result read after a navigation may come from another page, so it is not kept.
      if (navigated) break
      if (dropped === null) continue
      found.set(field.id, dropped)
      if (shape.form >= 0) usedForms.add(shape.form)
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
