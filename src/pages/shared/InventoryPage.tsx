import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Layers,
  Package,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { PortalTabs } from '@/components/layout/portal/PortalTabs'
import {
  getInventorySummary,
  getProducts,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { InventoryProductList } from '@/features/inventory/components/InventoryProductList'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, parseMoney } from '@/lib/money'
import { uniqueCategories } from '@/lib/product-categories'
import { getStockLevel, partitionStockAlerts } from '@/lib/stock'
import type { InventorySummary } from '@/data/api'
import type { Permissions } from '@/lib/roles'
import type { Product } from '@/types/database'

type InvTab = 'dashboard' | 'products' | 'alerts'
type AlertFilter = 'all' | 'low' | 'out'

function inventoryRouteState(pathname: string): {
  tab: InvTab
  alertFilter: AlertFilter
} {
  if (pathname === '/inventory/products') {
    return { tab: 'products', alertFilter: 'all' }
  }
  if (pathname === '/inventory/alerts/low') {
    return { tab: 'alerts', alertFilter: 'low' }
  }
  if (pathname === '/inventory/alerts/out') {
    return { tab: 'alerts', alertFilter: 'out' }
  }
  if (pathname === '/inventory/alerts') {
    return { tab: 'alerts', alertFilter: 'all' }
  }
  return { tab: 'dashboard', alertFilter: 'all' }
}

function tabToPath(tab: InvTab): string {
  if (tab === 'products') return '/inventory/products'
  if (tab === 'alerts') return '/inventory/alerts'
  return '/inventory'
}

function StockBar({
  stock,
  minimumQuantity,
}: {
  stock: number
  minimumQuantity?: number | null
}) {
  const min = minimumQuantity ?? 20
  const max = Math.max(min * 2, stock * 2, 1)
  const pct = Math.min(100, (stock / max) * 100)
  const level = getStockLevel(stock, minimumQuantity)
  const color =
    level === 'out'
      ? 'bg-red-400'
      : level === 'low'
        ? 'bg-amber-400'
        : 'bg-emerald-500'
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-background">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function formatStockValue(totalValue: number): string {
  if (totalValue >= 100000) return `₹${(totalValue / 100000).toFixed(2)}L`
  if (totalValue >= 1000) return `₹${(totalValue / 1000).toFixed(1)}k`
  return formatMoney(totalValue)
}

function InventoryQuickActions({
  permissions,
  onBrowseProducts,
  onViewAlerts,
}: {
  permissions: Permissions
  onBrowseProducts: () => void
  onViewAlerts: () => void
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onBrowseProducts}
        className="rounded-2xl border-2 border-emerald-500 bg-surface py-3.5 text-sm font-extrabold text-emerald-600"
      >
        Browse products
      </button>
      {permissions.canCreateProduct ? (
        <Link
          to="/inventory/new"
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-extrabold text-white shadow-md"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </Link>
      ) : (
        <button
          type="button"
          onClick={onViewAlerts}
          className="rounded-2xl bg-emerald-500 py-3.5 text-sm font-extrabold text-white shadow-md"
        >
          View alerts
        </button>
      )}
    </div>
  )
}

function InventoryDashboard({
  products,
  summary,
  onGoAlerts,
}: {
  products: Product[]
  summary: InventorySummary | undefined
  onGoAlerts: () => void
}) {
  const outOfStock = products.filter((p) => p.current_quantity === 0)
  const lowStock = products.filter(
    (p) =>
      p.current_quantity > 0 &&
      getStockLevel(p.current_quantity, p.minimum_quantity) === 'low',
  )
  const healthyStock = products.filter(
    (p) =>
      p.current_quantity > 0 &&
      getStockLevel(p.current_quantity, p.minimum_quantity) !== 'low',
  )
  const totalUnits = products.reduce((s, p) => s + p.current_quantity, 0)
  const totalValue = products.reduce(
    (s, p) => s + parseMoney(p.avg_unit_cost) * p.current_quantity,
    0,
  )

  const categoryRows = useMemo(() => {
    const map = new Map<
      string,
      { count: number; units: number; value: number }
    >()
    for (const p of products) {
      const cat = p.category?.trim() || 'Uncategorized'
      const row = map.get(cat) ?? { count: 0, units: 0, value: 0 }
      row.count += 1
      row.units += p.current_quantity
      row.value += parseMoney(p.avg_unit_cost) * p.current_quantity
      map.set(cat, row)
    }
    return [...map.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 6)
  }, [products])

  const topByUnits = useMemo(
    () =>
      [...products]
        .sort((a, b) => b.current_quantity - a.current_quantity)
        .slice(0, 5),
    [products],
  )

  const attention = [...outOfStock, ...lowStock].slice(0, 5)
  const stockTotal = Math.max(
    1,
    healthyStock.length + lowStock.length + outOfStock.length,
  )

  const cards = [
    {
      label: 'SKUs',
      value: products.length,
      hint: 'Active products',
      color: 'bg-violet-500',
      icon: Package,
      to: '/inventory/products',
    },
    {
      label: 'Units on hand',
      value: totalUnits.toLocaleString('en-IN'),
      hint: 'Total quantity',
      color: 'bg-emerald-500',
      icon: Layers,
      to: '/inventory/stock',
    },
    {
      label: 'Low stock',
      value: lowStock.length,
      hint: 'Needs reorder',
      color: 'bg-amber-500',
      icon: AlertTriangle,
      to: '/inventory/alerts/low',
    },
    {
      label: 'Out of stock',
      value: outOfStock.length,
      hint: 'Restock now',
      color: 'bg-red-500',
      icon: Ban,
      to: '/inventory/alerts/out',
    },
  ]

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-2">
      <Link
        to="/inventory/value"
        className="block rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white shadow-lg transition-transform active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">
              Inventory value (WAC)
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums">
              {formatStockValue(totalValue)}
            </p>
            <p className="mt-2 text-sm font-medium opacity-90">
              {formatMoney(totalValue)} at average cost
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <Wallet className="h-7 w-7" aria-hidden />
          </div>
        </div>
        {summary?.recent_adjustments ? (
          <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
            {summary.recent_adjustments} stock adjustment
            {summary.recent_adjustments === 1 ? '' : 's'} in the last 7 days
          </p>
        ) : null}
        <p className="mt-3 flex items-center gap-1 text-xs font-bold opacity-90">
          View breakdown
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </p>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              to={card.to}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-transform active:scale-[0.98] hover:border-emerald-200"
            >
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.color} text-white shadow-sm`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="text-3xl font-black tabular-nums text-foreground">
                {card.value}
              </div>
              <div className="mt-1 text-sm font-bold text-foreground">
                {card.label}
              </div>
              <div className="text-[11px] font-medium text-muted">{card.hint}</div>
              <ArrowRight
                className="mt-2 h-4 w-4 text-muted"
                aria-hidden
              />
            </Link>
          )
        })}
      </div>

      {products.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-foreground">Stock health</h2>
          <p className="mt-0.5 text-xs text-muted">How your catalog is distributed</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-background">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(healthyStock.length / stockTotal) * 100}%` }}
              title="Healthy"
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${(lowStock.length / stockTotal) * 100}%` }}
              title="Low"
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${(outOfStock.length / stockTotal) * 100}%` }}
              title="Out"
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
            <div>
              <span className="text-emerald-600">{healthyStock.length}</span>
              <span className="block font-medium text-muted">Healthy</span>
            </div>
            <div>
              <span className="text-amber-600">{lowStock.length}</span>
              <span className="block font-medium text-muted">Low</span>
            </div>
            <div>
              <span className="text-red-600">{outOfStock.length}</span>
              <span className="block font-medium text-muted">Out</span>
            </div>
          </div>
        </section>
      ) : null}

      {categoryRows.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground">By category</h2>
            <TrendingUp className="h-4 w-4 text-muted" aria-hidden />
          </div>
          <ul className="mt-3 space-y-2">
            {categoryRows.map(([name, row]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {name}
                  </p>
                  <p className="text-[11px] font-medium text-muted">
                    {row.count} products · {row.units} units
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-emerald-600">
                  {formatStockValue(row.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topByUnits.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-foreground">Top stock</h2>
          <p className="mt-0.5 text-xs text-muted">Highest quantity on hand</p>
          <ul className="mt-3 space-y-2">
            {topByUnits.map((p, i) => (
              <li key={p.id}>
                <Link
                  to={`/inventory/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-black text-emerald-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-muted">{p.product_code}</p>
                  </div>
                  <span className="text-lg font-black text-foreground tabular-nums">
                    {p.current_quantity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {attention.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground">
              Needs attention
            </h2>
            <button
              type="button"
              onClick={onGoAlerts}
              className="text-xs font-bold text-emerald-600"
            >
              See all
            </button>
          </div>
          <ul className="space-y-2">
            {attention.map((p) => {
              const isOut = p.current_quantity === 0
              return (
                <li key={p.id}>
                  <Link
                    to={`/inventory/${p.id}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                      isOut
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {p.name}
                      </p>
                      <p
                        className={`text-xs font-semibold ${isOut ? 'text-danger' : 'text-warning'}`}
                      >
                        {isOut ? 'Out of stock' : `Only ${p.current_quantity} left`}
                      </p>
                      {!isOut ? (
                        <StockBar
                          stock={p.current_quantity}
                          minimumQuantity={p.minimum_quantity}
                        />
                      ) : null}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : products.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <Package className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
          <p className="font-bold text-emerald-800">All stock levels look good</p>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-accent-soft/40 p-8 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-accent" />
          <p className="text-lg font-bold text-foreground">No products yet</p>
          <p className="mt-2 text-sm text-muted">
            Add products to see value, categories, and alerts here.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function InventoryAlerts({
  products,
  isLoading,
  errorMessage,
  filter = 'all',
}: {
  products: Product[]
  isLoading: boolean
  errorMessage: string | null
  filter?: AlertFilter
}) {
  const outOfStock = products.filter((p) => p.current_quantity === 0)
  const lowStock = products.filter(
    (p) =>
      p.current_quantity > 0 &&
      getStockLevel(p.current_quantity, p.minimum_quantity) === 'low',
  )

  const showOut = filter === 'all' || filter === 'out'
  const showLow = filter === 'all' || filter === 'low'

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-accent-soft" />
        ))}
      </div>
    )
  }

  if (errorMessage) {
    return (
      <p className="p-4 text-sm text-danger" role="alert">{errorMessage}</p>
    )
  }

  const emptyOut = showOut && outOfStock.length === 0
  const emptyLow = showLow && lowStock.length === 0
  if (
    (filter === 'out' && emptyOut) ||
    (filter === 'low' && emptyLow) ||
    (filter === 'all' && outOfStock.length === 0 && lowStock.length === 0)
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-muted">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Package className="h-6 w-6" />
        </div>
        <p className="font-bold text-foreground">All stock levels look good</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      {showOut && outOfStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-danger">
            Out of Stock
          </p>
          {outOfStock.map((p) => (
            <Link
              key={p.id}
              to={`/inventory/${p.id}`}
              className="mb-2 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3"
            >
              <div>
                <div className="text-sm font-bold text-foreground">{p.name}</div>
                <div className="text-xs font-semibold text-danger">Stock: 0</div>
              </div>
              <span className="text-xs font-bold text-success">
                Restock <ArrowRight className="inline h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {showLow && lowStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-warning">
            Low Stock
          </p>
          {lowStock.map((p) => (
            <Link
              key={p.id}
              to={`/inventory/${p.id}`}
              className="mb-2 block rounded-2xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-foreground">{p.name}</div>
                  <div className="text-xs font-semibold text-warning">
                    Stock: {p.current_quantity}
                  </div>
                </div>
                <span className="text-xs font-bold text-success">
                  Add Stock <ArrowRight className="inline h-3 w-3" />
                </span>
              </div>
              <StockBar
                stock={p.current_quantity}
                minimumQuantity={p.minimum_quantity}
              />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function InventoryPage() {
  const { permissions } = useAuth()
  const { shopId, productShopScope, productScopeKey } = useShopScope()
  const location = useLocation()
  const navigate = useNavigate()
  const { tab, alertFilter } = inventoryRouteState(location.pathname)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim())

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(deferredSearch, productScopeKey),
    queryFn: () => getProducts(deferredSearch, productShopScope),
  })

  const summaryQuery = useQuery({
    queryKey: [...queryKeys.inventory.summary, shopId ?? 'all'],
    queryFn: () => getInventorySummary(shopId),
  })

  const errorMessage = useMemo(() => {
    if (!productsQuery.error) return null
    logTechnicalError('getProducts', productsQuery.error)
    return toUserMessage(
      productsQuery.error,
      'Unable to load inventory. Please try again.',
    )
  }, [productsQuery.error])

  const products = productsQuery.data ?? []
  const categories = useMemo(
    () => ['All', ...uniqueCategories(products)],
    [products],
  )

  const filteredProducts = useMemo(() => {
    let list = products
    if (category && category !== 'All') {
      list = list.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase(),
      )
    }
    return list
  }, [products, category])

  const stockAlerts = useMemo(() => partitionStockAlerts(products), [products])
  const alertCount = stockAlerts.alertProducts.length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Inventory</h1>
        {tab === 'products' ? (
          <div className="relative mt-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
            />
          </div>
        ) : tab === 'dashboard' ? (
          <>
            <p className="mt-1 text-sm text-muted">Manage your stock</p>
            <InventoryQuickActions
              permissions={permissions}
              onBrowseProducts={() => navigate('/inventory/products')}
              onViewAlerts={() => navigate('/inventory/alerts')}
            />
          </>
        ) : tab === 'alerts' ? (
          <p className="mt-1 text-sm text-muted">
            {alertFilter === 'low'
              ? 'Products at or below minimum stock'
              : alertFilter === 'out'
                ? 'Products with zero quantity'
                : 'Manage your stock'}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Manage your stock</p>
        )}
      </div>

      <PortalTabs
        tone="emerald"
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'products', label: 'Products' },
          { id: 'alerts', label: 'Alerts', badge: alertCount },
        ]}
        activeId={tab}
        onChange={(id) => navigate(tabToPath(id as InvTab))}
      />

      {tab === 'dashboard' ? (
        <InventoryDashboard
          products={products}
          summary={summaryQuery.data}
          onGoAlerts={() => navigate('/inventory/alerts')}
        />
      ) : null}

      {tab === 'products' ? (
        <div className="flex flex-1 flex-col">
          {categories.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat === 'All' ? null : cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    (cat === 'All' && !category) || category === cat
                      ? 'bg-success text-white'
                      : 'bg-success-soft text-success'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {productsQuery.isLoading ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl bg-accent-soft"
                  />
                ))}
              </div>
            ) : errorMessage ? (
              <p className="p-4 text-sm text-danger" role="alert">
                {errorMessage}
              </p>
            ) : (
              <InventoryProductList products={filteredProducts} />
            )}
          </div>

          {permissions.canCreateProduct ? (
            <div className="relative border-t border-border bg-surface p-3">
              <div
                className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white to-transparent"
                aria-hidden
              />
              <Link
                to="/inventory/new"
                className="block w-full rounded-2xl bg-success py-4 text-center text-sm font-extrabold text-white shadow-lg transition-all active:scale-[0.98]"
              >
                + Add New Product
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'alerts' ? (
        <InventoryAlerts
          products={products}
          isLoading={productsQuery.isLoading}
          errorMessage={errorMessage}
          filter={alertFilter}
        />
      ) : null}
    </div>
  )
}
