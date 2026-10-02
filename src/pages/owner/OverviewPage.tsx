import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  LineChart,
  Package,
  Store,
  Trophy,
  Users,
} from 'lucide-react'

import {
  HomeMetricHero,
  HomeSection,
  HomeStatGrid,
} from '@/components/home/HomeUi'
import { ShopSwitcher } from '@/components/shop/ShopSwitcher'
import {
  getOwnerNetworkOverview,
  getRecentSales,
  getShopBusinessSummary,
  getShops,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { dashboardRangeBounds, formatTime } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function OwnerOverviewPage() {
  const { profile } = useAuth()
  const bounds = useMemo(() => dashboardRangeBounds('today'), [])
  const { shopId } = useShopScope()

  const networkQuery = useQuery({
    queryKey: queryKeys.shops.network(bounds.rangeKey),
    queryFn: () => getOwnerNetworkOverview(bounds.start, bounds.end),
    enabled: !shopId,
  })

  const shopsQuery = useQuery({
    queryKey: queryKeys.shops.all,
    queryFn: getShops,
  })

  const shopSummaryQuery = useQuery({
    queryKey: ['shop-summary', shopId, bounds.rangeKey],
    queryFn: () =>
      shopId
        ? getShopBusinessSummary(shopId, bounds.start, bounds.end)
        : Promise.reject(new Error('No shop')),
    enabled: Boolean(shopId),
  })

  const recentSalesQuery = useQuery({
    queryKey: [...queryKeys.sales.recent(5), shopId ?? 'all'],
    queryFn: () => getRecentSales(5, shopId),
  })

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const network = networkQuery.data
  const filteredShop = shopId
    ? (shopsQuery.data ?? []).find((s) => s.id === shopId)
    : null
  const shopSummary = shopSummaryQuery.data

  const headlineSales = shopId
    ? shopSummary?.netSales ?? 0
    : network?.total_net_sales ?? 0
  const headlineProfit = shopId ? shopSummary?.grossProfit ?? 0 : null
  const headlineLabel = shopId
    ? filteredShop?.name ?? 'Shop'
    : 'Today — all shops'

  const heroSub = shopId
    ? shopSummary?.hasSales
      ? `Profit ${formatMoney(headlineProfit ?? 0)} · ${shopSummary.unitsSold} units`
      : 'No sales recorded yet today'
    : network
      ? `${network.total_sale_count} sales · ${network.shop_count} shops`
      : undefined

  const heroFooter =
    !shopId && network ? (
      <div className="flex flex-wrap gap-2">
        <Link
          to="/inventory/alerts"
          className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
        >
          {network.attention_count} stock alert
          {network.attention_count !== 1 ? 's' : ''}
        </Link>
        <Link
          to="/sales"
          className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
        >
          View sales
        </Link>
      </div>
    ) : shopId ? (
      <Link
        to={`/shops/${shopId}`}
        className="inline-flex items-center gap-1 text-xs font-bold opacity-90"
      >
        Shop details <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    ) : null

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Your business</p>
            <h1 className="text-2xl font-black text-foreground">
              Hi, {firstName}
            </h1>
          </div>
          <ShopSwitcher />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
        <HomeMetricHero
          tone="indigo"
          label={headlineLabel}
          value={formatMoney(headlineSales)}
          sub={heroSub}
          footer={heroFooter}
        />

        {!shopId && network ? (
          <HomeStatGrid
            items={[
              {
                to: '/sales',
                label: 'Sales',
                value: network.total_sale_count,
                hint: 'Transactions today',
                icon: LineChart,
                accent: 'bg-violet-500',
              },
              {
                to: '/manage',
                label: 'Shops',
                value: network.shop_count,
                hint: 'In your network',
                icon: Store,
                accent: 'bg-indigo-500',
              },
              {
                to: '/inventory/alerts',
                label: 'Alerts',
                value: network.attention_count,
                hint: 'Stock attention',
                icon: AlertTriangle,
                accent: 'bg-amber-500',
              },
              {
                to: '/inventory',
                label: 'Stock',
                value: 'View',
                hint: 'Inventory hub',
                icon: Package,
                accent: 'bg-emerald-500',
              },
            ]}
          />
        ) : null}

        {shopId && shopSummary ? (
          <HomeStatGrid
            items={[
              {
                to: '/sales',
                label: 'Units',
                value: shopSummary.unitsSold,
                hint: 'Sold today',
                icon: LineChart,
                accent: 'bg-violet-500',
              },
              {
                to: '/inventory',
                label: 'Stock',
                value: 'Open',
                hint: 'This shop',
                icon: Package,
                accent: 'bg-emerald-500',
              },
            ]}
          />
        ) : null}

        {!shopId && network?.best_shop_name ? (
          <Link
            to={
              network.best_shop_id
                ? `/shops/${network.best_shop_id}`
                : '/overview'
            }
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft">
              <Trophy className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-muted">Top sales today</div>
              <div className="text-sm font-extrabold text-foreground">
                {network.best_shop_name}
              </div>
            </div>
            <div className="text-sm font-black text-accent">
              {formatMoney(network.best_shop_net_sales)}
            </div>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/sales"
            className="rounded-2xl border border-border bg-surface py-3.5 text-center text-sm font-extrabold text-foreground shadow-sm"
          >
            Sales
          </Link>
          <Link
            to="/manage"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3.5 text-sm font-extrabold text-foreground shadow-sm"
          >
            <Users className="h-4 w-4 text-accent" aria-hidden />
            Shops & team
          </Link>
        </div>

        {!shopId && network ? (
          <HomeSection
            title="Shop performance"
            subtitle="Tap a shop for details"
            action={{ label: 'Manage', to: '/manage' }}
          >
            <ul>
              {network.shops.map((shop) => (
                <li key={shop.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/shops/${shop.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-accent-soft/40"
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
                          ? `Stock manager: ${shop.manager_name}`
                          : 'No stock manager'}
                        {' · '}
                        {shop.sale_count} sale
                        {shop.sale_count !== 1 ? 's' : ''}
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
          </HomeSection>
        ) : null}

        {(recentSalesQuery.data ?? []).length > 0 ? (
          <HomeSection
            title="Recent sales"
            subtitle="Latest across your scope"
            action={{ label: 'All sales', to: '/sales' }}
          >
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
          </HomeSection>
        ) : null}
      </div>
    </div>
  )
}
