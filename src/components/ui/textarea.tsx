import type { TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
