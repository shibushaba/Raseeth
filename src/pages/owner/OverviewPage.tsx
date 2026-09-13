import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  getBusinessSummary,
  getBusinessTrend,
  getInventorySummary,
  getRecentSales,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  dashboardRangeBounds,
  formatTime,
  trendBucketLabel,
  type DashboardRangeKey,
} from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

type WeekBar = { label: string; sales: number; profit: number }

function WeeklyChart({
  data,
  selected,
  onSelect,
}: {
  data: WeekBar[]
  selected: WeekBar | null
  onSelect: (bar: WeekBar | null) => void
}) {
  const max = Math.max(...data.map((d) => d.sales), 1)

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="text-sm font-extrabold text-foreground">This week</div>
      <div className="mt-3 flex items-end gap-1.5" style={{ height: '88px' }}>
        {data.map((d) => {
          const pct = (d.sales / max) * 100
          const isSel = selected?.label === d.label
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => onSelect(isSel ? null : d)}
              className="flex h-full flex-1 flex-col items-center gap-1"
            >
              <div className="flex w-full flex-1 items-end justify-center">
                {d.sales > 0 ? (
                  <div
                    className={`w-full rounded-t-lg transition-all ${isSel ? 'bg-accent' : 'bg-accent-soft'}`}
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  />
                ) : (
                  <div className="h-1 w-full rounded-sm bg-background" />
                )}
              </div>
              <span
                className={`text-[10px] font-bold ${isSel ? 'text-accent' : 'text-muted'}`}
              >
                {d.label}
              </span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-border bg-accent-soft/40 p-4">
          <div className="mb-3 text-sm font-bold text-accent">
            {selected.label}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <div className="mb-1 text-xs font-semibold text-muted">Sales</div>
              <div className="text-lg font-black text-accent">
                {formatMoney(selected.sales)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <div className="mb-1 text-xs font-semibold text-muted">Profit</div>
              <div className="text-lg font-black text-success">
                {formatMoney(selected.profit)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function OwnerOverviewPage() {
  const { profile } = useAuth()
  const [range] = useState<DashboardRangeKey>('today')
  const [selectedBar, setSelectedBar] = useState<WeekBar | null>(null)
  const bounds = useMemo(() => dashboardRangeBounds(range), [range])

  const summaryQuery = useQuery({
    queryKey: queryKeys.business.summary(bounds.rangeKey),
    queryFn: () => getBusinessSummary(bounds.start, bounds.end),
  })

  const trendQuery = useQuery({
    queryKey: queryKeys.business.trend('7d'),
    queryFn: () => {
      const weekBounds = dashboardRangeBounds('7d')
      return getBusinessTrend(weekBounds.start, weekBounds.end)
    },
  })

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory.summary,
    queryFn: getInventorySummary,
  })

  const recentSalesQuery = useQuery({
    queryKey: queryKeys.sales.recent(5),
    queryFn: () => getRecentSales(5),
  })

  const summary = summaryQuery.data
  const inv = inventoryQuery.data
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Owner'

  const weekBars: WeekBar[] = useMemo(() => {
    const points = trendQuery.data ?? []
    return points.map((p) => ({
      label: trendBucketLabel(p.periodStart, '7d'),
      sales: p.netSales,
      profit: p.grossProfit ?? 0,
    }))
  }, [trendQuery.data])

  const weekTotal = weekBars.reduce((s, d) => s + d.sales, 0)
  const weekProfit = weekBars.reduce((s, d) => s + d.profit, 0)

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Hi, {firstName}</h1>
        <p className="text-sm text-muted">Here&apos;s your business overview</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-accent p-5 text-white shadow-md">
          <div className="text-sm font-semibold opacity-70">Today&apos;s Profit</div>
          <div className="mt-1 text-4xl font-black">
            {summary?.hasSales
              ? formatMoney(summary.grossProfit)
              : formatMoney(0)}
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <div>
              <span className="opacity-70">Sales </span>
              <span className="font-extrabold">
                {summary?.hasSales ? formatMoney(summary.netSales) : '₹0'}
              </span>
            </div>
            <div>
              <span className="opacity-70">Orders </span>
              <span className="font-extrabold">{summary?.unitsSold ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/inventory"
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-2xl font-black text-accent">
              {inv?.total_products ?? 0}
            </div>
            <div className="mt-0.5 text-xs font-bold text-muted">Products</div>
          </Link>
          <Link
            to="/inventory"
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-2xl font-black text-danger">
              {(inv?.low_stock ?? 0) + (inv?.out_of_stock ?? 0)}
            </div>
            <div className="mt-0.5 text-xs font-bold text-muted">Alerts</div>
          </Link>
        </div>

        <WeeklyChart
          data={weekBars}
          selected={selectedBar}
          onSelect={setSelectedBar}
        />

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-extrabold text-foreground">Week total</span>
            <span className="font-black text-accent">
              {formatMoney(weekTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-extrabold text-success">Week profit</span>
            <span className="font-black text-success">
              {formatMoney(weekProfit)}
            </span>
          </div>
        </div>

        {(recentSalesQuery.data ?? []).length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3 text-sm font-extrabold text-foreground">
              Recent sales
            </div>
            <ul>
              {(recentSalesQuery.data ?? []).map((sale) => (
                <li key={sale.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/sales/${sale.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {sale.sale_number}
                      </div>
                      <div className="text-xs text-muted">
                        {formatTime(sale.created_at)}
                      </div>
                    </div>
                    <span className="font-black text-accent">
                      {formatMoney(sale.total_amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
