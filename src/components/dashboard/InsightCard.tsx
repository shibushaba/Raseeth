import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardBody } from '@/components/ui/card'
import type { BusinessSignalType } from '@/lib/business-pulse'
import { cn } from '@/lib/utils'

function iconFor(type: BusinessSignalType) {
  if (type === 'TOP_PRODUCT' || type === 'INVENTORY_ACTIVITY') return TrendingUp
  if (type === 'MARGIN_DROP' || type === 'RETURN_SPIKE') return TrendingDown
  return AlertTriangle
}

function toneFor(type: BusinessSignalType) {
  if (type === 'OUT_OF_STOCK' || type === 'RETURN_SPIKE' || type === 'MARGIN_DROP')
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
  const Icon = iconFor(type)
  const body = (
    <Card className={cn(href && 'transition-shadow hover:shadow-md')}>
      <CardBody className={cn('flex gap-3', compact ? 'py-3' : 'gap-4 py-4')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            compact ? 'h-9 w-9' : 'h-10 w-10',
            toneFor(type),
          )}
        >
          <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="eyebrow">{title}</p>
          <p className="mt-1 text-sm text-muted">{description}</p>
          {href ? (
            <p className="mt-2 text-sm font-medium text-accent">
              {compact ? 'View →' : 'View →'}
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
    >
      {body}
    </Link>
  )
}
