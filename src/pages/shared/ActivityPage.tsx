import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'

import { PortalBackBar } from '@/components/ui/portal-field'
import { getRecentActivity } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { groupByDay } from '@/lib/datetime'
import { formatTime } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { homePathFor } from '@/lib/roles'
import type { ActivityItem } from '@/types/activity'

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

function typeColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'SALE':
      return 'bg-accent-soft text-accent'
    case 'RETURN':
      return 'bg-red-100 text-red-600'
    case 'STOCK_ADDED':
    case 'STOCK_ADJUSTED':
      return 'bg-emerald-100 text-emerald-700'
    case 'PRODUCT_CREATED':
      return 'bg-indigo-100 text-indigo-700'
    default:
      return 'bg-accent-soft text-muted'
  }
}

export function ActivityPage() {
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.feed(role ?? 'OWNER', user?.id ?? ''),
    queryFn: () =>
      getRecentActivity({
        userId: user!.id,
        role: role!,
        limit: 50,
      }),
    enabled: Boolean(user?.id && role),
  })

  const groups = groupByDay(activityQuery.data ?? [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <PortalBackBar
        title={role === 'SALESMAN' ? 'My Activity' : 'Activity'}
        onBack={() => navigate(role ? homePathFor(role) : '/')}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {activityQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-accent-soft" />
            ))}
          </div>
        ) : null}

        {activityQuery.error ? (
          <p className="text-sm text-danger" role="alert">
            {(() => {
              logTechnicalError('getRecentActivity', activityQuery.error)
              return toUserMessage(
                activityQuery.error,
                'Unable to load activity.',
              )
            })()}
          </p>
        ) : null}

        {!activityQuery.isLoading &&
        !activityQuery.error &&
        (activityQuery.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
            <Activity className="h-8 w-8" aria-hidden />
            <p className="font-semibold">No activity yet</p>
          </div>
        ) : null}

        {groups.map((group) => (
          <section key={group.dayKey} className="mb-6">
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.items.map((item) => {
                const inner = (
                  <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${typeColor(item.type)}`}
                      >
                        {typeLabel(item.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {item.description ?? item.title}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {formatTime(item.createdAt)}
                          {item.actor?.name ? ` · ${item.actor.name}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )

                return item.href ? (
                  <Link key={item.id} to={item.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={item.id}>{inner}</div>
                )
              })}
            </div>
          </section>
        ))}

        {!activityQuery.isLoading && !activityQuery.error ? (
          <p className="text-center text-xs text-muted">
            Last 7 days of activity
          </p>
        ) : null}
      </div>
    </div>
  )
}
