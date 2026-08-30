import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white shadow-md hover:bg-violet-700 dark:hover:bg-violet-500',
        secondary:
          'border-2 border-accent bg-surface text-accent hover:bg-accent-soft/50 dark:hover:bg-stone-800/60',
        ghost:
          'bg-transparent text-foreground hover:bg-accent-soft/60 dark:hover:bg-stone-800/60',
        accent:
          'bg-accent text-white shadow-md hover:bg-violet-700 dark:hover:bg-violet-500',
        success:
          'bg-success text-white shadow-md hover:bg-emerald-600',
        danger: 'bg-danger text-white shadow-md hover:bg-red-600',
      },
      size: {
        sm: 'h-10 px-3.5 text-sm',
        md: 'h-11 px-4',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
