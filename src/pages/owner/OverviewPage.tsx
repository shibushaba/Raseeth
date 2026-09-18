import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Store, Trophy } from 'lucide-react'

import {
  getOwnerNetworkOverview,
  getRecentSales,
  getShopBusinessSummary,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { dashboardRangeBounds, formatTime } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function OwnerOverviewPage() {
  const { profile, role } = useAuth()
  const bounds = useMemo(() => dashboardRangeBounds('today'), [])
  const { shopId, myShop } = useShopScope()

  const isOwner = role === 'OWNER'
  const isManager = role === 'MANAGER'

  const networkQuery = useQuery({
    queryKey: queryKeys.shops.network(bounds.rangeKey),
    queryFn: () => getOwnerNetworkOverview(bounds.start, bounds.end),
    enabled: isOwner,
  })

  const shopSummaryQuery = useQuery({
    queryKey: ['shop-summary', shopId, bounds.rangeKey],
    queryFn: () =>
      shopId
        ? getShopBusinessSummary(shopId, bounds.start, bounds.end)
        : Promise.reject(new Error('No shop')),
    enabled: isManager && Boolean(shopId),
  })

  const recentSalesQuery = useQuery({
    queryKey: [...queryKeys.sales.recent(5), shopId ?? 'all'],
    queryFn: () => getRecentSales(5, isOwner ? null : shopId),
  })

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const summary = isManager ? shopSummaryQuery.data : null
  const network = networkQuery.data

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Hi, {firstName}</h1>
        <p className="text-sm text-muted">
          {isOwner
            ? "Here's your network overview"
            : myShop
              ? `${myShop.name} — shop overview`
              : 'Your shop overview'}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isOwner && network ? (
          <>
            <div className="rounded-2xl bg-accent p-5 text-white shadow-md">
              <div className="text-sm font-semibold opacity-70">
                Today — all shops
              </div>
              <div className="mt-1 text-4xl font-black">
                {formatMoney(network.total_net_sales)}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="opacity-70">Sales </span>
                  <span className="font-extrabold">
                    {network.total_sale_count}
                  </span>
                </div>
                <div>
                  <span className="opacity-70">Shops </span>
                  <span className="font-extrabold">{network.shop_count}</span>
                </div>
                <div>
                  <span className="opacity-70">Stock alerts </span>
                  <span className="font-extrabold">
                    {network.attention_count}
                  </span>
                </div>
              </div>
            </div>

            {network.best_shop_name ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft">
                  <Trophy className="h-5 w-5 text-success" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-muted">Best shop today</div>
                  <div className="text-sm font-extrabold text-foreground">
                    {network.best_shop_name}
                  </div>
                </div>
                <div className="text-sm font-black text-accent">
                  {formatMoney(network.best_shop_net_sales)}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-extrabold text-foreground">Shops</h3>
                <p className="text-xs text-muted">Tap for shop details</p>
              </div>
              <ul>
                {network.shops.map((shop) => (
                  <li key={shop.id} className="border-b border-border last:border-0">
                    <Link
                      to={`/shops/${shop.id}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
                        <Store className="h-4 w-4 text-accent" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-foreground">
                          {shop.name}
                        </div>
                        <div className="text-xs text-muted">
                          {shop.manager_name
                            ? `Manager: ${shop.manager_name}`
                            : 'No manager'}
                          {' · '}
                          {shop.sale_count} sale
                          {shop.sale_count !== 1 ? 's' : ''} today
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-accent">
                          {formatMoney(shop.net_sales)}
                        </div>
                        <ChevronRight
                          className="ml-auto h-4 w-4 text-muted"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/manage"
              className="block rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/30 px-4 py-3 text-center text-sm font-extrabold text-accent"
            >
              Manage shops & assign managers
            </Link>
          </>
        ) : null}

        {isManager ? (
          <div className="rounded-2xl bg-accent p-5 text-white shadow-md">
            <div className="text-sm font-semibold opacity-70">Today&apos;s profit</div>
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
                <span className="opacity-70">Units </span>
                <span className="font-extrabold">{summary?.unitsSold ?? 0}</span>
              </div>
            </div>
          </div>
        ) : null}

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
