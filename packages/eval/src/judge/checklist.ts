import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type ChecklistPoint = { id: string; text: string }
export type Checklist = { screen: string; points: ChecklistPoint[] }

export const CHECKLIST_DIR = fileURLToPath(new URL('../../checklists/', import.meta.url))

const isPoint = (x: unknown): x is ChecklistPoint => {
  const p = x as Partial<ChecklistPoint> | null
  return !!p && typeof p.id === 'string' && /^p\d+$/.test(p.id) && typeof p.text === 'string' && p.text.length > 0
}

/** The checklist for one bench screen. Throws when the file is missing or malformed. */
export function loadChecklist(screen: string): Checklist {
  // Screen ids are plain slugs; anything else cannot name a file here.
  if (!/^[a-z][a-z0-9-]*$/.test(screen)) throw new Error(`Unknown checklist screen: ${screen}`)
  const file = `${CHECKLIST_DIR}${screen}.json`
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`Could not read checklist ${file}: ${e instanceof Error ? e.message : String(e)}`)
  }
  const c = raw as Partial<Checklist> | null
  if (!c || c.screen !== screen || !Array.isArray(c.points) || !c.points.every(isPoint)) {
    throw new Error(`Checklist ${file} needs screen "${screen}" and points with ids p1.. and text.`)
  }
  return { screen, points: c.points.map((p) => ({ id: p.id, text: p.text })) }
}
