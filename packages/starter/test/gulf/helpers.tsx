import { useState, type ReactElement } from 'react'
import { expect } from 'vitest'
import { configureAxe } from 'vitest-axe'

// jsdom draws nothing, so axe cannot measure contrast there; every other rule runs.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } })
import { renderIn, SCRIPTS } from '../components/helpers'

export { SCRIPTS, renderIn }

type Controlled = { value: string; onChange: (value: string) => void }

/** Holds the value the way an app would, so tests drive the component as a person does. */
export function Harness({ initial = '', children }: { initial?: string; children: (props: Controlled) => ReactElement }) {
  const [value, setValue] = useState(initial)
  return children({ value, onChange: setValue })
}

export async function expectNoAxeViolations(container: Element) {
  const results = await axe(container)
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
