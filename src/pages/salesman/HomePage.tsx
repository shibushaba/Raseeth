import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  getInventorySummary,
  getRecentActivity,
  getUnreadMessageCount,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { ActivityPreviewList } from '@/features/activity/components/ActivityFeed'
import { useAuth } from '@/features/auth/AuthProvider'
import { greetingForHour } from '@/lib/datetime'

/** Salesman landing — speed-first classic POS home. */
export function SalesmanHomePage() {
  const { user, role } = useAuth()

  const unreadQuery = useQuery({
    queryKey: queryKeys.messages.unreadCount,
    queryFn: getUnreadMessageCount,
    refetchInterval: 30_000,
  })

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory.summary,
    queryFn: getInventorySummary,
  })

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.preview(role ?? 'SALESMAN', user?.id ?? ''),
    queryFn: () =>
      getRecentActivity({
        userId: user!.id,
        role: role!,
        limit: 5,
      }),
    enabled: Boolean(user?.id && role),
  })

  const unread = unreadQuery.data ?? 0
  const needsAttention = inventoryQuery.data?.needs_attention ?? 0
  const totalProducts = inventoryQuery.data?.total_products ?? 0
  const noProductsYet =
    !inventoryQuery.isLoading && totalProducts === 0

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-5">
        <p className="app-kicker">{greetingForHour()}</p>
      </header>

      <Link
        to="/sales"
        className="flex min-h-14 w-full items-center justify-center rounded-sm border border-primary bg-primary px-6 text-lg font-semibold tracking-wide text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:min-h-16 sm:text-xl"
      >
        Sell
      </Link>

      {noProductsYet ? (
        <p className="mt-3 text-sm text-muted">
          Ready to make your first sale.
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="app-kicker">Quick actions</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/inventory"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Add Stock
          </Link>
          <Link
            to="/inventory"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-border bg-surface px-4 text-sm font-medium text-muted hover:bg-neutral-50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Inventory
          </Link>
        </div>
      </section>

      {inventoryQuery.isLoading ? (
        <div className="mt-6 h-5 animate-pulse bg-neutral-100" />
      ) : needsAttention > 0 ? (
        <p className="mt-6 text-sm text-foreground">
          <Link
            to="/inventory"
            className="underline hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {needsAttention === 1
              ? '1 product needs stock attention.'
              : `${needsAttention} products need stock attention.`}
          </Link>
        </p>
      ) : null}

      <section className="mt-8 section-rule">
        <Link
          to="/messages"
          aria-label={
            unread > 0 ? `Messages, ${unread} unread` : 'Messages, no unread'
          }
          className="flex items-baseline justify-between gap-3 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <div>
            <p className="app-kicker">Messages</p>
            <p className="mt-1 text-sm text-foreground">
              {unread === 0 ? 'No unread messages' : `${unread} unread`}
            </p>
          </div>
        </Link>
      </section>

      <section className="mt-8 section-rule">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="app-kicker">Recent activity</h2>
          <Link
            to="/activity"
            className="text-sm text-muted underline hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            View Activity
          </Link>
        </div>
        {activityQuery.isLoading ? (
          <div className="h-14 animate-pulse bg-neutral-100" />
        ) : (
          <ActivityPreviewList
            items={(activityQuery.data ?? []).slice(0, 3)}
            emptyLabel="Nothing here yet. Your activity will appear after your first sale or stock update."
          />
        )}
      </section>
    </div>
  )
}
