import { Link } from 'react-router-dom'

import { AppIcon } from '@/components/ui/icon'
import { Card, CardBody } from '@/components/ui/card'
import type { BusinessSignalType } from '@/lib/business-pulse'
import {
  Alert02Icon,
  ArrowRight01Icon,
  TrendingDownIcon,
  TrendingUpIcon,
} from '@/lib/icons'
import type { IconSvgElement } from '@hugeicons/react'
import { cn } from '@/lib/utils'

function iconFor(type: BusinessSignalType): IconSvgElement {
  if (type === 'TOP_PRODUCT' || type === 'INVENTORY_ACTIVITY')
    return TrendingUpIcon
  if (type === 'MARGIN_DROP' || type === 'RETURN_SPIKE')
    return TrendingDownIcon
  return Alert02Icon
}

function toneFor(type: BusinessSignalType) {
  if (
    type === 'OUT_OF_STOCK' ||
    type === 'RETURN_SPIKE' ||
    type === 'MARGIN_DROP'
  )
    return 'text-danger bg-danger-soft'
  if (type === 'LOW_STOCK') return 'text-warning bg-warning-soft'
  return 'text-accent bg-accent-soft'
}

export function InsightCard({
  type,
  title,
  description,
  href,
  compact,
}: {
  type: BusinessSignalType
  title: string
  description: string
  href?: string
  compact?: boolean
}) {
  const body = (
    <Card className={cn(href && 'transition-shadow hover:shadow-md')}>
      <CardBody className={cn('flex gap-3', compact ? 'py-3' : 'gap-4 py-4')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl',
            compact ? 'h-9 w-9' : 'h-10 w-10',
            toneFor(type),
          )}
        >
          <AppIcon icon={iconFor(type)} size={compact ? 'sm' : 'md'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{description}</p>
          {href ? (
            <p className="mt-2 flex items-center gap-1 text-xs font-bold text-accent">
              View
              <AppIcon icon={ArrowRight01Icon} size="sm" />
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )

  if (!href) return body

  return (
    <Link
      to={href}
      className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={title}
    >
      {body}
    </Link>
  )
}
