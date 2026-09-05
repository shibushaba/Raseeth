import { forwardRef, useState } from 'react'

import { AppIcon } from '@/components/ui/icon'
import { Input, type InputProps } from '@/components/ui/input'
import { EyeIcon, EyeOffIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', className)}
          {...props}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          <AppIcon
            icon={EyeIcon}
            altIcon={EyeOffIcon}
            showAlt={visible}
            size="md"
          />
        </button>
      </div>
    )
  },
)
