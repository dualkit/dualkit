// Shared bits of the kit previews: the green status square, a status line and the decorative glass icons.
import type { ReactNode } from 'react'

export const Status = ({ children }: { children: ReactNode }) => (
  <span className="v3-pv-status"><i className="v3-pv-dot" aria-hidden="true" />{children}</span>
)

const stroke = (d: string, size: number) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const PvArrow = ({ size = 14 }: { size?: number }) => stroke('M3 8h10M9.5 4.5L13 8l-3.5 3.5', size)
export const PvCheck = ({ size = 12 }: { size?: number }) => stroke('M3.5 8.5l3 3 6-7', size)
export const PvCopy = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 3.5v-.25a.75.75 0 00-.75-.75h-6.5a.75.75 0 00-.75.75v6.5c0 .41.34.75.75.75h.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
