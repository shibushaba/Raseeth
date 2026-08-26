import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  getBusinessPulse,
  getBusinessSummary,
  getInventorySummary,
  getRecentActivity,
  getRecentSales,
  getTopProducts,
  getUnreadMessageCount,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { ActivityPreviewList } from '@/features/activity/components/ActivityFeed'
import { BusinessPulsePanel } from '@/features/owner/components/BusinessPulsePanel'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  dashboardRangeBounds,
  formatTime,
  greetingForHour,
  type DashboardRangeKey,
} from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS: Array<{ key: DashboardRangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
]

function OverviewSection({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="section-rule">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="app-kicker">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="border border-border bg-surface px-3 py-3">
      <p className="app-kicker">{label}</p>
      <p className="mt-1.5 text-xl tabular-nums font-semibold tracking-tight sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-1.5',
        emphasis && 'mt-1 border-t border-neutral-200 pt-3 font-medium',
      )}
    >
      <span className={cn('text-sm', emphasis ? 'text-black' : 'text-neutral-600')}>
        {label}
      </span>
      <span className="tabular-nums text-sm">{value}</span>
    </div>
  )
}

function formatCoveragePct(coverage: number): string {
  return `${Math.round(coverage * 100)}%`
}

function formatMargin(margin: number | null): string {
  if (margin === null) return '—'
  return `${margin.toFixed(1)}%`
}

export function OwnerOverviewPage() {
  const { user, role } = useAuth()
  const [range, setRange] = useState<DashboardRangeKey>('today')
  const bounds = useMemo(() => dashboardRangeBounds(range), [range])

  const summaryQuery = useQuery({
    queryKey: queryKeys.business.summary(bounds.rangeKey),
    queryFn: () => getBusinessSummary(bounds.start, bounds.end),
  })

  const pulseQuery = useQuery({
    queryKey: queryKeys.business.pulse(bounds.rangeKey),
    queryFn: () => getBusinessPulse(bounds.start, bounds.end),
  })

  const topQuery = useQuery({
    queryKey: queryKeys.business.topProducts(bounds.rangeKey, 5),
    queryFn: () => getTopProducts(bounds.start, bounds.end, 5),
  })

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory.summary,
    queryFn: getInventorySummary,
  })

  const recentQuery = useQuery({
    queryKey: queryKeys.sales.recent(5),
    queryFn: () => getRecentSales(5),
  })

  const unreadQuery = useQuery({
    queryKey: queryKeys.messages.unreadCount,
    queryFn: getUnreadMessageCount,
    refetchInterval: 30_000,
  })

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.preview(role ?? 'OWNER', user?.id ?? ''),
    queryFn: () =>
      getRecentActivity({
        userId: user!.id,
        role: role!,
        limit: 5,
      }),
    enabled: Boolean(user?.id && role),
  })

  const summary = summaryQuery.data
  const coveragePct = summary ? Math.round(summary.costCoverage * 100) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-1">
      <header className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="app-kicker">{greetingForHour()}</p>
          <h1 className="mt-1 app-heading">Overview</h1>
        </div>
        <div
          className="flex flex-wrap gap-0.5 border border-border bg-surface p-0.5"
          role="group"
          aria-label="Date range"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              aria-pressed={range === opt.key}
              className={cn(
                'min-h-10 rounded-sm px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                range === opt.key
                  ? 'bg-primary text-white'
                  : 'text-muted hover:bg-neutral-100 hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border border-border bg-surface px-3 py-2 text-sm">
        <span className="app-kicker">Quick actions</span>
        <Link
          to="/inventory"
          className="text-foreground underline hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Inventory
        </Link>
        <Link
          to="/sales"
          className="text-foreground underline hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Sales
        </Link>
        <Link
          to="/messages"
          className="text-foreground underline hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Messages
        </Link>
      </div>

      <OverviewSection title="Business Pulse">
        <BusinessPulsePanel
          pulse={pulseQuery.data}
          isLoading={pulseQuery.isLoading}
          errorMessage={
            pulseQuery.error
              ? (() => {
                  logTechnicalError('getBusinessPulse', pulseQuery.error)
                  return 'unavailable'
                })()
              : null
          }
        />
      </OverviewSection>

      <OverviewSection title="Performance">
        {summaryQuery.isLoading ? (
          <div className="h-28 animate-pulse bg-neutral-100" />
        ) : summaryQuery.error ? (
          <p className="text-sm text-red-700" role="alert">
            {(() => {
              logTechnicalError('getBusinessSummary', summaryQuery.error)
              return toUserMessage(
                summaryQuery.error,
                'Unable to load business performance.',
              )
            })()}
          </p>
        ) : !summary?.hasSales ? (
          <div>
            <p className="text-lg">No sales yet.</p>
            <p className="mt-2 text-sm text-neutral-600">
              Business performance will appear here once transactions begin.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <MetricBlock
                label="Net Sales"
                value={formatMoney(summary.netSales)}
              />
              <MetricBlock
                label="Gross Profit"
                value={
                  summary.grossProfit === null
                    ? '—'
                    : formatMoney(summary.grossProfit)
                }
              />
              <MetricBlock
                label="Margin"
                value={formatMargin(summary.grossMargin)}
              />
              <MetricBlock
                label="Units Sold"
                value={String(summary.unitsSold)}
              />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Sales
                </p>
                <BreakdownRow
                  label="Gross Sales"
                  value={formatMoney(summary.grossSales)}
                />
                <BreakdownRow
                  label="Returns"
                  value={formatMoney(summary.returns)}
                />
                <BreakdownRow
                  label="Net Sales"
                  value={formatMoney(summary.netSales)}
                  emphasis
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Profit
                </p>
                {summary.grossProfit === null ? (
                  <div>
                    <BreakdownRow label="Gross Profit" value="—" />
                    <p className="mt-3 text-sm text-neutral-600">
                      Cost coverage {formatCoveragePct(summary.costCoverage)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Profitability will appear as new cost-tracked sales are
                      recorded.
                    </p>
                  </div>
                ) : (
                  <div>
                    <BreakdownRow
                      label="Net Sales"
                      value={formatMoney(summary.netSales)}
                    />
                    <BreakdownRow
                      label="COGS"
                      value={formatMoney(summary.cogs ?? 0)}
                    />
                    <BreakdownRow
                      label="Gross Profit"
                      value={formatMoney(summary.grossProfit)}
                      emphasis
                    />
                    <div className="mt-3 flex items-baseline justify-between gap-4">
                      <span className="text-sm text-neutral-600">Margin</span>
                      <span className="tabular-nums text-sm">
                        {formatMargin(summary.grossMargin)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-neutral-600">
                      Cost coverage {formatCoveragePct(summary.costCoverage)}
                    </p>
                    {coveragePct < 100 ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        Profit based on transactions with available cost data
                        ({coveragePct}% coverage).
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </OverviewSection>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-10">
        <OverviewSection title="Top products">
          {topQuery.isLoading ? (
            <div className="h-24 animate-pulse bg-neutral-100" />
          ) : topQuery.error ? (
            <p className="text-sm text-red-700">
              {toUserMessage(topQuery.error, 'Unable to load top products.')}
            </p>
          ) : (topQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-600">
              Top products appear once cost-tracked sales are recorded.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {topQuery.data?.map((p) => (
                <li
                  key={p.productId}
                  className="flex items-baseline justify-between gap-3 py-3"
                >
                  <Link
                    to={`/inventory/${p.productId}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    {p.productName}
                  </Link>
                  <span className="shrink-0 tabular-nums text-sm">
                    {formatMoney(p.grossProfit)} profit
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewSection>

        <OverviewSection
          title="Needs attention"
          action={
            <Link
              to="/inventory"
              className="text-sm text-neutral-600 underline hover:text-black"
            >
              View Inventory
            </Link>
          }
        >
          {inventoryQuery.isLoading ? (
            <div className="h-20 animate-pulse bg-neutral-100" />
          ) : inventoryQuery.error ? (
            <p className="text-sm text-red-700">
              {toUserMessage(
                inventoryQuery.error,
                'Unable to load inventory summary.',
              )}
            </p>
          ) : (inventoryQuery.data?.total_products ?? 0) === 0 ? (
            <p className="text-sm text-foreground">No products yet.</p>
          ) : (inventoryQuery.data?.needs_attention ?? 0) === 0 &&
            (inventoryQuery.data?.recent_adjustments ?? 0) === 0 ? (
            <p className="text-sm text-neutral-600">
              Inventory looks steady for now.
            </p>
          ) : (
            <ul className="space-y-4">
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-neutral-600">Total products</span>
                <span className="tabular-nums text-lg font-medium">
                  {inventoryQuery.data?.total_products ?? 0}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-neutral-600">
                  Products needing attention
                </span>
                <span className="tabular-nums text-lg font-medium">
                  {inventoryQuery.data?.needs_attention ?? 0}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-neutral-600">
                  Adjustments (7 days)
                </span>
                <span className="tabular-nums text-lg font-medium">
                  {inventoryQuery.data?.recent_adjustments ?? 0}
                </span>
              </li>
            </ul>
          )}
        </OverviewSection>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-10">
        <OverviewSection
          title="Recent sales"
          action={
            <Link
              to="/sales"
              className="text-sm text-neutral-600 underline hover:text-black"
            >
              View Sales
            </Link>
          }
        >
          {recentQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-neutral-100" />
              ))}
            </div>
          ) : recentQuery.error ? (
            <p className="text-sm text-red-700">
              {(() => {
                logTechnicalError('getRecentSales', recentQuery.error)
                return toUserMessage(
                  recentQuery.error,
                  'Unable to load recent sales.',
                )
              })()}
            </p>
          ) : (recentQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-600">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {recentQuery.data?.map((sale) => (
                <li key={sale.id}>
                  <Link
                    to={`/sales/${sale.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-neutral-50"
                  >
                    <div>
                      <p className="font-mono text-sm">{sale.sale_number}</p>
                      <p className="text-xs text-neutral-500">
                        {formatTime(sale.created_at)}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm font-medium">
                      {formatMoney(sale.total_amount)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OverviewSection>

        <OverviewSection
          title="Recent activity"
          action={
            <Link
              to="/activity"
              className="text-sm text-neutral-600 underline hover:text-black"
            >
              View Activity
            </Link>
          }
        >
          {activityQuery.isLoading ? (
            <div className="h-16 animate-pulse bg-neutral-100" />
          ) : activityQuery.error ? (
            <p className="text-sm text-red-700">
              {toUserMessage(
                activityQuery.error,
                'Unable to load activity.',
              )}
            </p>
          ) : (
            <ActivityPreviewList
              items={(activityQuery.data ?? []).slice(0, 5)}
            />
          )}
        </OverviewSection>
      </div>

      <OverviewSection
        title="Messages"
        action={
          <Link
            to="/messages"
            className="text-sm text-neutral-600 underline hover:text-black"
          >
            View Messages
          </Link>
        }
      >
        <Link to="/messages" className="block py-1 hover:bg-neutral-50">
          <p className="text-lg">{unreadQuery.data ?? 0} unread</p>
        </Link>
      </OverviewSection>
    </div>
  )
}
