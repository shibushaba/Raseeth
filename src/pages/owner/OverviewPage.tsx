import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { InsightCard } from '@/components/dashboard/InsightCard'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PeriodSwitcher } from '@/components/dashboard/PeriodSwitcher'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { Card, CardBody } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getBusinessPulse,
  getBusinessSummary,
  getBusinessTrend,
  getInventorySummary,
  getRecentActivity,
  getRecentSales,
  getTopProducts,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { ActivityPreviewList } from '@/features/activity/components/ActivityFeed'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  dashboardRangeBounds,
  formatTime,
  greetingForHour,
  trendBucketLabel,
  type DashboardRangeKey,
} from '@/lib/datetime'
import { toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'

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

  const trendQuery = useQuery({
    queryKey: queryKeys.business.trend(bounds.rangeKey),
    queryFn: () => getBusinessTrend(bounds.start, bounds.end),
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

  const recentSalesQuery = useQuery({
    queryKey: queryKeys.sales.recent(5),
    queryFn: () => getRecentSales(5),
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
  const trendData = useMemo(
    () =>
      (trendQuery.data ?? []).map((p) => ({
        label: trendBucketLabel(p.periodStart, range),
        sales: p.netSales,
        profit: p.grossProfit,
      })),
    [trendQuery.data, range],
  )

  const insights = pulseQuery.data?.signals.slice(0, 3) ?? []
  const inv = inventoryQuery.data
  const inStock = inv
    ? Math.max(0, inv.total_products - inv.out_of_stock - inv.low_stock)
    : 0

  return (
    <div className="mx-auto max-w-3xl space-y-8 lg:max-w-none">
      <header className="space-y-4">
        <div>
          <h1 className="page-title">{greetingForHour()}</h1>
          <p className="page-subtitle">Your store at a glance</p>
        </div>
        <PeriodSwitcher value={range} onChange={setRange} />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <MetricCard
          label="Sales"
          value={
            summary?.hasSales ? formatMoney(summary.netSales) : '₹0'
          }
          loading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Profit"
          value={
            summary?.grossProfit === null || summary?.grossProfit === undefined
              ? '—'
              : formatMoney(summary.grossProfit)
          }
          loading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Margin"
          value={formatMargin(summary?.grossMargin ?? null)}
          loading={summaryQuery.isLoading}
        />
      </div>

      {!summaryQuery.isLoading && summary && !summary.hasSales ? (
        <Card>
          <CardBody className="py-8 text-center">
            <p className="text-base font-medium text-foreground">No sales yet.</p>
            <p className="mt-2 text-sm text-muted">
              Your store&apos;s performance will appear here once you start
              selling.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <TrendChart
        title="Sales"
        subtitle="Is business going up or down?"
        data={trendData}
        loading={trendQuery.isLoading}
        showProfit={false}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Insights" />
          {pulseQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : pulseQuery.error ? (
            <p className="text-sm text-muted" role="status">
              Insights are unavailable right now.
            </p>
          ) : insights.length === 0 ? (
            <Card>
              <CardBody className="py-6">
                <p className="text-sm text-muted">
                  Everything looks good. Nothing needs your attention.
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {insights.map((signal) => (
                <InsightCard
                  key={signal.id}
                  type={signal.type}
                  title={signal.title.replace(/_/g, ' ')}
                  description={signal.description}
                  href={signal.href}
                  compact
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title="Inventory"
            actionLabel="View inventory"
            actionTo="/inventory"
          />
          {inventoryQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : inventoryQuery.error ? (
            <p className="text-sm text-danger">
              {toUserMessage(
                inventoryQuery.error,
                'Unable to load inventory summary.',
              )}
            </p>
          ) : inv?.total_products === 0 ? (
            <Card>
              <CardBody className="py-6">
                <p className="text-sm font-medium text-foreground">
                  No products yet.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-4 py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Total products</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {inv?.total_products ?? 0}
                  </span>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <StatRow label="In stock" value={inStock} tone="success" />
                  <StatRow label="Low stock" value={inv?.low_stock ?? 0} tone="warning" />
                  <StatRow label="Out of stock" value={inv?.out_of_stock ?? 0} tone="danger" />
                </div>
              </CardBody>
            </Card>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Top products" />
          {topQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : topQuery.error ? (
            <p className="text-sm text-muted">
              {toUserMessage(topQuery.error, 'Unable to load top products.')}
            </p>
          ) : (topQuery.data ?? []).length === 0 ? (
            <Card>
              <CardBody className="py-6 text-sm text-muted">
                Top products appear once you have sales with tracked costs.
              </CardBody>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {(topQuery.data ?? []).map((p) => (
                  <li key={p.productId}>
                    <Link
                      to={`/inventory/${p.productId}`}
                      className="row-hover flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {p.productName}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {formatMoney(p.grossProfit)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionHeader
            title="Recent sales"
            actionLabel="View sales"
            actionTo="/sales"
          />
          {recentSalesQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (recentSalesQuery.data ?? []).length === 0 ? (
            <Card>
              <CardBody className="py-6 text-sm text-muted">
                No sales yet.
              </CardBody>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {(recentSalesQuery.data ?? []).map((sale) => (
                  <li key={sale.id}>
                    <Link
                      to={`/sales/${sale.id}`}
                      className="row-hover flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div>
                        <p className="font-medium">{sale.sale_number}</p>
                        <p className="text-sm text-muted">
                          {formatTime(sale.created_at)}
                        </p>
                      </div>
                      <span className="tabular-nums font-semibold">
                        {formatMoney(sale.total_amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <section>
        <SectionHeader
          title="Recent activity"
          actionLabel="View all"
          actionTo="/activity"
        />
        {activityQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ActivityPreviewList
            items={(activityQuery.data ?? []).slice(0, 5)}
            emptyLabel="No activity yet."
          />
        )}
      </section>
    </div>
  )
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'warning' | 'danger'
}) {
  const dot =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-danger'
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}
