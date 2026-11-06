// A local stand-in for the shadcn Label, with its classes and without Radix, for tests and the site demos.
// It is not shipped: the registry items declare `label` as a registry dependency.
import type { ComponentProps } from 'react'

const BASE = 'flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50'

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label data-slot="label" className={className ? `${BASE} ${className}` : BASE} {...props} />
}
