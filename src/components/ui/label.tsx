import type { LabelHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted',
        className,
      )}
      {...props}
    />
  )
}
