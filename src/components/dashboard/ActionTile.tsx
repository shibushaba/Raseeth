import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function ActionTile({
  to,
  title,
  description,
  icon: Icon,
  tone = 'violet',
  className,
}: {
  to: string
  title: string
  description: string
  icon?: LucideIcon
  tone?: 'violet' | 'emerald'
  className?: string
}) {
  const iconWrap =
    tone === 'emerald'
      ? 'bg-inventory-soft text-inventory dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-accent-soft text-accent dark:bg-violet-950 dark:text-violet-300'

  return (
    <Link to={to} className={cn('portal-card group', className)}>
      <div className="flex items-start gap-4">
        {Icon ? (
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              iconWrap,
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-foreground">{title}</p>
          <p className="mt-1 text-sm font-medium text-muted">{description}</p>
          <p className="mt-3 text-sm font-bold text-accent group-hover:underline">
            {title === 'Sales' ? 'Make a sale' : 'Manage stock'} →
          </p>
        </div>
      </div>
    </Link>
  )
}
