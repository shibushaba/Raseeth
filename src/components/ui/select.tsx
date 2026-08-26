import type { SelectHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
