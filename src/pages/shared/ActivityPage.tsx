import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { getRecentActivity } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { ActivityEvent } from '@/features/activity/components/ActivityFeed'
import { useAuth } from '@/features/auth/AuthProvider'
import { groupByDay } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'

export function ActivityPage() {
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

  const isSalesman = role === 'SALESMAN'
  const groups = groupByDay(activityQuery.data ?? [])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={isSalesman ? 'My activity' : 'Activity'}
        description={
          isSalesman
            ? 'Your recent sales, stock changes, and messages.'
            : 'What happened in the business recently.'
        }
      />

      {activityQuery.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
          <p className="text-sm text-neutral-500">Loading activity…</p>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {activityQuery.error ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-red-700">
            {(() => {
              logTechnicalError('getRecentActivity', activityQuery.error)
              return toUserMessage(
                activityQuery.error,
                'Unable to load activity.',
              )
            })()}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void activityQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {!activityQuery.isLoading &&
      !activityQuery.error &&
      (activityQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No activity yet."
          description="Your business activity will appear here as you work."
        />
      ) : null}

      {!activityQuery.isLoading && !activityQuery.error
        ? groups.map((group) => (
            <section key={group.dayKey} className="mb-10">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {group.label}
              </h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <ActivityEvent item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}

      {!activityQuery.isLoading && !activityQuery.error ? (
        <p className="text-xs text-neutral-500">
          Showing recent activity from the last 7 days.
        </p>
      ) : null}

      <div className="mt-8">
        <Link
          to={isSalesman ? '/home' : '/overview'}
          className="text-sm text-neutral-600 underline hover:text-black"
        >
          Back
        </Link>
      </div>
    </div>
  )
}
