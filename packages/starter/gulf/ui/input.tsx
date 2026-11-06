// A local copy of the shadcn Input (new-york, v4), so the gulf components can be tested and demoed here.
// It is not shipped: the registry items declare `input` as a registry dependency and use the app's own copy.
import type { ComponentProps } from 'react'

const BASE = [
  'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
  'dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs',
  'transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
].join(' ')

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={className ? `${BASE} ${className}` : BASE} {...props} />
}
