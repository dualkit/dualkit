// 16px icons, 1.5 stroke, coloured by currentColor. Directional ones carry a class that CSS flips in right to left.
const PATHS = {
  forward: 'M3 8h10M9.5 4.5L13 8l-3.5 3.5',
  back: 'M13 8H3M7.5 3.5L3 8l4.5 4.5',
  close: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  check: 'M3.5 8.5l3 3 6-7',
  calendar: 'M3 4h10v9H3zM3 6.75h10M5.75 2.5v3M10.25 2.5v3',
  alert: 'M8 5v3.5M8 10.75v.25M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
  info: 'M8 7.25v4M8 5v.25M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
} as const

export type IconName = keyof typeof PATHS
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['forward', 'back'])

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className={DIRECTIONAL.has(name) ? 'dk-icon dk-icon--directional' : 'dk-icon'} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
