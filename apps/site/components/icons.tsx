// Icons on a 16px grid, 1.5 stroke, coloured by currentColor. The mark is Sam's, drawn in Figma on 13 Oct 2026.
type P = { className?: string; size?: number }

const MARK_START = 'M 8.9855 18.5469 C 8.9855 19.4675 8.2087 20.1961 7.3483 19.9526 C 3.1124 18.7535 0 14.7519 0 10 C 0 5.2481 3.1124 1.2465 7.3483 0.0474 C 8.2087 -0.1961 8.9855 0.5325 8.9855 1.4531 L 8.9855 18.5469 Z'
const MARK_END = 'M 11.0145 1.4531 C 11.0145 0.5325 11.7913 -0.1961 12.6517 0.0474 C 16.8876 1.2465 20 5.2481 20 10 C 20 14.7519 16.8876 18.7535 12.6517 19.9526 C 11.7913 20.1961 11.0145 19.4675 11.0145 18.5469 L 11.0145 1.4531 Z'

export function Mark({ light = 'var(--mark-light)' }: { light?: string }) {
  return (
    <svg className="mark" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d={MARK_START} fill="var(--ink)" />
      <path d={MARK_END} fill={light} />
    </svg>
  )
}

const Stroke = ({ d, size = 16, className }: P & { d: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ArrowIcon = (p: P) => <Stroke {...p} d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" />
export const BackIcon = (p: P) => <Stroke {...p} d="M13 8H3M7.5 3.5L3 8l4.5 4.5" />
export const CheckIcon = (p: P) => <Stroke {...p} d="M3.5 8.5l3 3 6-7" />
export const StarIcon = (p: P) => <Stroke {...p} d="M8 2.2l1.75 3.55 3.9.57-2.82 2.75.66 3.88L8 11.12l-3.49 1.83.66-3.88L2.35 6.32l3.9-.57L8 2.2z" />
export const CursorIcon = (p: P) => <Stroke {...p} d="M3.5 2.5l9 4.2-3.9 1.2-1.3 3.9-3.8-9.3z" />
export const FeedbackIcon = (p: P) => <Stroke {...p} d="M2.75 4.25c0-.83.67-1.5 1.5-1.5h7.5c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5H7l-3 2.5v-2.5h.25c-.83 0-1.5-.67-1.5-1.5v-5.5z" />
export const ChevronIcon = (p: P) => <Stroke {...p} d="M4 6l4 4 4-4" />

export function CopyIcon() {
  return (
    <span className="copy-ico" aria-hidden="true">
      <svg className="sheet" viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 3.5v-.25a.75.75 0 00-.75-.75h-6.5a.75.75 0 00-.75.75v6.5c0 .41.34.75.75.75h.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <svg className="tick" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  )
}

export function RssIcon(p: P) {
  return (
    <svg className={p.className} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3.5a9.5 9.5 0 019.5 9.5M3 7.5A5.5 5.5 0 018.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3.75" cy="12.25" r="1.25" fill="currentColor" />
    </svg>
  )
}
