import { Link } from 'react-router-dom'

import type { ActivityItem } from '@/types/activity'
import { formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

function typeLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'SALE':
      return 'Sale'
    case 'RETURN':
      return 'Return'
    case 'STOCK_ADDED':
      return 'Stock added'
    case 'STOCK_ADJUSTED':
      return 'Stock adjusted'
    case 'PRODUCT_CREATED':
      return 'Product created'
    case 'MESSAGE':
      return 'Message'
  }
}

export function ActivityEvent({ item }: { item: ActivityItem }) {
  const body = (
    <div className="flex gap-3 border-b border-border py-3">
      <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted sm:w-16">
        {formatTime(item.createdAt)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          {item.description ?? item.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {typeLabel(item.type)}
          {item.actor?.name ? ` · ${item.actor.name}` : ''}
        </p>
      </div>
    </div>
  )

  if (item.href) {
    return (
      <Link
        to={item.href}
        className={cn('block row-hover')}
      >
        {body}
      </Link>
    )
  }

  return body
}

export function ActivityPreviewList({
  items,
  emptyLabel = 'No recent activity.',
}: {
  items: ActivityItem[]
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return <p className="section-hint">{emptyLabel}</p>
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <Link
              to={item.href}
              className="row-hover flex items-start justify-between gap-3 border-b border-border py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{item.description ?? item.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {typeLabel(item.type)}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatTime(item.createdAt)}
              </span>
            </Link>
          ) : (
            <div className="flex items-start justify-between gap-3 border-b border-border py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{item.description ?? item.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {typeLabel(item.type)}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatTime(item.createdAt)}
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
