import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function ActionTile({
  to,
  title,
  description,
  icon: Icon,
  className,
}: {
  to: string
  title: string
  description: string
  icon?: LucideIcon
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'card group flex min-h-[132px] flex-col justify-between rounded-lg p-5 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-[148px] sm:p-6',
        className,
      )}
    >
      <div>
        {Icon ? (
          <Icon
            className="mb-3 h-6 w-6 text-accent sm:mb-4 sm:h-7 sm:w-7"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
        <p className="text-lg font-semibold uppercase tracking-wide text-foreground sm:text-xl">
          {title}
        </p>
        <p className="mt-1.5 text-sm text-muted sm:text-base">{description}</p>
      </div>
      <p className="mt-4 text-sm font-medium text-accent group-hover:underline">
        {title === 'Sales' ? 'Make a sale' : 'Manage stock'} →
      </p>
    </Link>
  )
}
