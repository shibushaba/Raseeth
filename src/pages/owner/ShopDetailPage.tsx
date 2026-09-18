import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PortalBackBar } from '@/components/ui/portal-field'
import {
  getRecentSales,
  getShopBusinessSummary,
  getShops,
  getStockAlertProducts,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { dashboardRangeBounds, formatTime } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function ShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>()
  const navigate = useNavigate()
  const bounds = useMemo(() => dashboardRangeBounds('today'), [])

  const shopsQuery = useQuery({
    queryKey: queryKeys.shops.all,
    queryFn: getShops,
  })

  const shop = (shopsQuery.data ?? []).find((s) => s.id === shopId)

  const summaryQuery = useQuery({
    queryKey: ['shop-summary', shopId, bounds.rangeKey],
    queryFn: () =>
      getShopBusinessSummary(shopId!, bounds.start, bounds.end),
    enabled: Boolean(shopId),
  })

  const alertsQuery = useQuery({
    queryKey: [...queryKeys.inventory.alerts, shopId],
    queryFn: () => getStockAlertProducts(shopId),
    enabled: Boolean(shopId),
  })

  const salesQuery = useQuery({
    queryKey: [...queryKeys.sales.recent(8), shopId],
    queryFn: () => getRecentSales(8, shopId),
    enabled: Boolean(shopId),
  })

  const summary = summaryQuery.data
  const alerts = alertsQuery.data ?? []

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <PortalBackBar
        title={shop?.name ?? 'Shop'}
        onBack={() => navigate('/overview')}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {shop ? (
          <p className="text-sm text-muted">
            Manager:{' '}
            <span className="font-bold text-foreground">
              {shop.manager_name ?? 'Not assigned'}
            </span>
            {' · '}
            {shop.worker_count} worker{shop.worker_count !== 1 ? 's' : ''}
          </p>
        ) : null}

        <div className="rounded-2xl bg-accent p-5 text-white shadow-md">
          <div className="text-sm font-semibold opacity-70">Today</div>
          <div className="mt-1 text-3xl font-black">
            {formatMoney(summary?.netSales ?? 0)}
          </div>
          <div className="mt-2 text-sm opacity-90">
            Profit {formatMoney(summary?.grossProfit ?? 0)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/inventory"
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="text-2xl font-black text-danger">{alerts.length}</div>
            <div className="text-xs font-bold text-muted">Stock alerts</div>
          </Link>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="text-2xl font-black text-accent">
              {summary?.unitsSold ?? 0}
            </div>
            <div className="text-xs font-bold text-muted">Units sold</div>
          </div>
        </div>

        {alerts.length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3 text-sm font-extrabold">
              Needs attention
            </div>
            <ul>
              {alerts.slice(0, 5).map((p) => (
                <li key={p.id} className="border-b border-border px-4 py-2 last:border-0">
                  <Link to={`/inventory/${p.id}`} className="text-sm font-bold">
                    {p.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    Qty {p.current_quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(salesQuery.data ?? []).length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-3 text-sm font-extrabold">
              Recent sales
            </div>
            <ul>
              {(salesQuery.data ?? []).map((sale) => (
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
