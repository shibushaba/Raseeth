import { Link } from 'react-router-dom'

import type { ActivityItem } from '@/types/activity'
import { formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

function typeLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'SALE':
      return 'SALE'
    case 'RETURN':
      return 'RETURN'
    case 'STOCK_ADDED':
      return 'STOCK ADDED'
    case 'STOCK_ADJUSTED':
      return 'STOCK ADJUSTED'
    case 'PRODUCT_CREATED':
      return 'PRODUCT CREATED'
    case 'MESSAGE':
      return 'MESSAGE'
  }
}

export function ActivityEvent({ item }: { item: ActivityItem }) {
  const body = (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-border py-2.5 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <span className="pt-0.5 text-xs tabular-nums text-muted">
        {formatTime(item.createdAt)}
      </span>
      <div className="min-w-0">
        <p className="app-kicker">{typeLabel(item.type)}</p>
        <p className="mt-0.5 text-sm text-foreground">
          {item.description ?? item.title}
        </p>
        {item.actor?.name ? (
          <p className="mt-0.5 text-xs text-muted">{item.actor.name}</p>
        ) : null}
      </div>
    </div>
  )

  if (item.href) {
    return (
      <Link
        to={item.href}
        className={cn('block hover:bg-neutral-50 focus-visible:bg-neutral-50')}
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
    return <p className="text-sm text-muted">{emptyLabel}</p>
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.href ? (
            <Link
              to={item.href}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border py-2.5 hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <p className="app-kicker">{typeLabel(item.type)}</p>
                <p className="mt-0.5 truncate text-sm">
                  {item.description ?? item.title}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {formatTime(item.createdAt)}
              </span>
            </Link>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border py-2.5">
              <div className="min-w-0">
                <p className="app-kicker">{typeLabel(item.type)}</p>
                <p className="mt-0.5 truncate text-sm">
                  {item.description ?? item.title}
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
