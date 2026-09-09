import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PortalHeader } from '@/components/layout/portal/PortalHeader'
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
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <div className="font-extrabold text-sm text-gray-700">This week</div>
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
                    className={`w-full rounded-t-lg transition-all ${isSel ? 'bg-indigo-600' : 'bg-violet-200'}`}
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  />
                ) : (
                  <div className="h-1 w-full rounded-sm bg-gray-100" />
                )}
              </div>
              <span
                className={`text-[10px] font-bold ${isSel ? 'text-indigo-700' : 'text-gray-400'}`}
              >
                {d.label}
              </span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="mb-3 text-sm font-bold text-indigo-700">
            {selected.label}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-indigo-100 bg-white p-3 text-center">
              <div className="mb-1 text-xs font-semibold text-gray-500">
                Sales
              </div>
              <div className="text-lg font-black text-indigo-700">
                {formatMoney(selected.sales)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center">
              <div className="mb-1 text-xs font-semibold text-gray-500">
                Profit
              </div>
              <div className="text-lg font-black text-emerald-600">
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
  const { profile, signOut } = useAuth()
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
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <PortalHeader
        tone="indigo"
        subtitle="Owner"
        title={`Hi, ${firstName}`}
        onLogout={() => void signOut()}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-indigo-700 p-5 text-white">
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
          <div className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm">
            <span className="opacity-70">This month </span>
            <span className="font-extrabold">
              {summary?.hasSales ? formatMoney(summary.grossProfit) : '₹0'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/inventory"
            className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-black text-violet-700">
              {inv?.total_products ?? 0}
            </div>
            <div className="mt-0.5 text-xs font-bold text-gray-500">
              Products
            </div>
          </Link>
          <Link
            to="/inventory"
            className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-black text-red-500">
              {(inv?.low_stock ?? 0) + (inv?.out_of_stock ?? 0)}
            </div>
            <div className="mt-0.5 text-xs font-bold text-gray-500">
              Alerts
            </div>
          </Link>
        </div>

        <WeeklyChart
          data={weekBars}
          selected={selectedBar}
          onSelect={setSelectedBar}
        />

        <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-extrabold text-gray-700">Week total</span>
            <span className="font-black text-indigo-700">
              {formatMoney(weekTotal)}
            </span>
          </div>
          <div className="mb-4 flex justify-between text-sm">
            <span className="font-extrabold text-emerald-700">Week profit</span>
            <span className="font-black text-emerald-600">
              {formatMoney(weekProfit)}
            </span>
          </div>

        </div>

        {(recentSalesQuery.data ?? []).length > 0 ? (
          <div className="rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="border-b border-violet-50 px-4 py-3 font-extrabold text-sm text-gray-700">
              Recent sales
            </div>
            <ul>
              {(recentSalesQuery.data ?? []).map((sale) => (
                <li key={sale.id} className="border-b border-violet-50 last:border-0">
                  <Link
                    to={`/sales/${sale.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {sale.sale_number}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTime(sale.created_at)}
                      </div>
                    </div>
                    <span className="font-black text-violet-700">
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
