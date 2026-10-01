import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'

import {
  getRecentSales,
  getShopBusinessSummary,
  getStockAlertProducts,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { dashboardRangeBounds, formatTime } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function ManagerHomePage() {
  const { profile } = useAuth()
  const { shopId, myShop } = useShopScope()
  const bounds = dashboardRangeBounds('today')
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const summaryQuery = useQuery({
    queryKey: ['shop-summary', shopId, bounds.rangeKey],
    queryFn: () =>
      shopId
        ? getShopBusinessSummary(shopId, bounds.start, bounds.end)
        : Promise.reject(new Error('No shop')),
    enabled: Boolean(shopId),
  })

  const alertsQuery = useQuery({
    queryKey: [...queryKeys.inventory.alerts, shopId],
    queryFn: () => getStockAlertProducts(shopId),
    enabled: Boolean(shopId),
  })

  const recentSalesQuery = useQuery({
    queryKey: [...queryKeys.sales.recent(5), shopId],
    queryFn: () => getRecentSales(5, shopId),
    enabled: Boolean(shopId),
  })

  const summary = summaryQuery.data
  const alertCount = alertsQuery.data?.length ?? 0

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <p className="text-sm text-muted">Good morning, {firstName}</p>
        <h1 className="text-2xl font-black text-foreground">
          {myShop?.name ?? 'Your shop'}
        </h1>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-xs font-bold text-muted">Today&apos;s sales</div>
            <div className="mt-1 text-2xl font-black text-accent">
              {formatMoney(summary?.netSales ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-xs font-bold text-muted">Today&apos;s profit</div>
            <div className="mt-1 text-2xl font-black text-success">
              {summary?.hasSales ? formatMoney(summary.grossProfit) : formatMoney(0)}
            </div>
          </div>
        </div>

        <Link
          to="/sales"
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-extrabold text-white shadow-md"
        >
          <Plus className="h-5 w-5" aria-hidden />
          New sale
        </Link>

        {alertCount > 0 ? (
          <Link
            to="/inventory"
            className="block rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger"
          >
            {alertCount} product{alertCount !== 1 ? 's' : ''} need stock attention
          </Link>
        ) : null}

        <Link
          to="/team"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm"
        >
          <Users className="h-5 w-5 text-accent" aria-hidden />
          <span className="text-sm font-bold text-foreground">Salesmen</span>
        </Link>

        {(recentSalesQuery.data ?? []).length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3 text-sm font-extrabold">
              Recent sales
            </div>
            <ul>
              {(recentSalesQuery.data ?? []).map((sale) => (
                <li key={sale.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/sales/${sale.id}`}
                    className="flex justify-between px-4 py-3"
                  >
                    <span className="text-sm font-bold">{sale.sale_number}</span>
                    <span className="text-xs text-muted">
                      {formatTime(sale.created_at)}
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
