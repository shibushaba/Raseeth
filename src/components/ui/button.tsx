import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary:
          'border-primary bg-primary text-white hover:bg-neutral-800',
        secondary:
          'border-border-strong bg-surface text-foreground hover:bg-neutral-100',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-neutral-100',
        danger:
          'border-danger bg-danger text-white hover:bg-red-900',
      },
      size: {
        sm: 'h-9 rounded-sm px-3',
        md: 'h-11 rounded-sm px-4',
        lg: 'h-12 rounded-sm px-5 text-base',
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
