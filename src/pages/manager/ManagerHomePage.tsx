import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  Layers,
  Package,
  Plus,
  Wallet,
} from 'lucide-react'

import {
  HomeHero,
  HomeListRow,
  HomeQuickActions,
  HomeSection,
  HomeStatGrid,
} from '@/components/home/HomeUi'
import { getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { formatMoney, parseMoney } from '@/lib/money'
import { partitionStockAlerts } from '@/lib/stock'

export function ManagerHomePage() {
  const { profile } = useAuth()
  const { shopId, myShop, productShopScope, productScopeKey } = useShopScope()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list('', productScopeKey),
    queryFn: () => getProducts(undefined, productShopScope),
    enabled: Boolean(shopId),
  })

  const products = productsQuery.data ?? []

  const stats = useMemo(() => {
    const { outOfStock, lowStock } = partitionStockAlerts(products)
    const out = outOfStock.length
    const low = lowStock.length
    const units = products.reduce((s, p) => s + p.current_quantity, 0)
    const value = products.reduce(
      (s, p) => s + parseMoney(p.avg_unit_cost) * p.current_quantity,
      0,
    )
    return { out, low, units, value, skus: products.length }
  }, [products])

  const stockAlerts = useMemo(() => partitionStockAlerts(products), [products])

  const topStock = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.current_quantity - a.current_quantity)
        .slice(0, 4),
    [products],
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="space-y-4 overflow-y-auto p-4 pb-8">
        <HomeHero
          tone="emerald"
          greeting={`Good morning, ${firstName}`}
          title={myShop?.name ?? 'Your shop'}
          subtitle="Stock manager"
        />

        <HomeStatGrid
          items={[
            {
              to: '/inventory/products',
              label: 'SKUs',
              value: stats.skus,
              hint: 'Active products',
              icon: Package,
              accent: 'bg-violet-500',
            },
            {
              to: '/inventory/stock',
              label: 'Units',
              value: stats.units.toLocaleString('en-IN'),
              hint: 'On hand',
              icon: Layers,
              accent: 'bg-emerald-500',
            },
            {
              to: '/inventory/alerts/low',
              label: 'Low stock',
              value: stats.low,
              hint: 'Below minimum',
              icon: AlertTriangle,
              accent: 'bg-amber-500',
            },
            {
              to: '/inventory/alerts/out',
              label: 'Out',
              value: stats.out,
              hint: 'Restock now',
              icon: Ban,
              accent: 'bg-red-500',
            },
          ]}
        />

        <Link
          to="/inventory/value"
          className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-emerald-800/70">
                Inventory value
              </p>
              <p className="text-lg font-black text-emerald-900">
                {formatMoney(stats.value)}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700">WAC →</span>
        </Link>

        <HomeQuickActions
          actions={[
            {
              to: '/inventory',
              label: 'Open inventory',
              icon: Package,
              primary: true,
            },
            { to: '/inventory/new', label: 'Add product', icon: Plus },
          ]}
        />

        {stockAlerts.alertProducts.length > 0 ? (
          <HomeSection
            title="Needs attention"
            subtitle="Tap to restock or adjust"
            action={{ label: 'All alerts', to: '/inventory/alerts' }}
          >
            <ul>
              {stockAlerts.alertProducts.slice(0, 5).map((p) => (
                <HomeListRow
                  key={p.id}
                  to={`/inventory/${p.id}`}
                  title={p.name}
                  meta={
                    p.current_quantity === 0
                      ? 'Out of stock'
                      : `${p.current_quantity} left · min ${p.minimum_quantity ?? 5}`
                  }
                  trailing={
                    <span
                      className={
                        p.current_quantity === 0
                          ? 'text-xs font-bold text-danger'
                          : 'text-xs font-bold text-warning'
                      }
                    >
                      {p.current_quantity === 0 ? 'Out' : 'Low'}
                    </span>
                  }
                />
              ))}
            </ul>
          </HomeSection>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-5 text-center">
            <p className="font-bold text-emerald-800">Stock levels look good</p>
            <p className="mt-1 text-sm text-emerald-700/80">
              No low or out-of-stock alerts right now.
            </p>
          </div>
        )}

        {topStock.length > 0 ? (
          <HomeSection title="Top stock" subtitle="Highest quantity on hand">
            <ul>
              {topStock.map((p) => (
                <HomeListRow
                  key={p.id}
                  to={`/inventory/${p.id}`}
                  title={p.name}
                  meta={p.product_code}
                  trailing={
                    <span className="text-sm font-black tabular-nums">
                      {p.current_quantity}
                    </span>
                  }
                />
              ))}
            </ul>
          </HomeSection>
        ) : null}
      </div>
    </div>
  )
}
