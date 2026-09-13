import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Package,
  Wallet,
} from 'lucide-react'

import { PortalTabs } from '@/components/layout/portal/PortalTabs'
import { getInventorySummary, getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { InventoryProductList } from '@/features/inventory/components/InventoryProductList'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, parseMoney } from '@/lib/money'
import { uniqueCategories } from '@/lib/product-categories'
import { getStockLevel } from '@/lib/stock'
import type { Product } from '@/types/database'

type InvTab = 'dashboard' | 'products' | 'alerts'

function StockBar({ stock }: { stock: number }) {
  const max = Math.max(20, stock * 2)
  const pct = Math.min(100, (stock / max) * 100)
  const level = getStockLevel(stock)
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

function InventoryDashboard({
  products,
  onGoAlerts,
}: {
  products: Product[]
  onGoAlerts: () => void
}) {
  const outOfStock = products.filter((p) => p.current_quantity === 0)
  const lowStock = products.filter(
    (p) => p.current_quantity > 0 && getStockLevel(p.current_quantity) === 'low',
  )
  const totalValue = products.reduce(
    (s, p) => s + parseMoney(p.avg_unit_cost) * p.current_quantity,
    0,
  )
  const valueLabel =
    totalValue >= 100000
      ? `₹${(totalValue / 100000).toFixed(2)}L`
      : totalValue >= 1000
        ? `₹${(totalValue / 1000).toFixed(1)}k`
        : formatMoney(totalValue)

  const cards = [
    { label: 'Products', value: products.length, color: 'bg-accent', icon: Package },
    { label: 'Stock Value', value: valueLabel, color: 'bg-success', icon: Wallet },
    { label: 'Low Stock', value: lowStock.length, color: 'bg-warning', icon: AlertTriangle },
    { label: 'Out of Stock', value: outOfStock.length, color: 'bg-danger', icon: Ban },
  ]

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.color} text-white`}>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="text-2xl font-black text-foreground">{card.value}</div>
              <div className="mt-0.5 text-xs font-semibold text-muted">{card.label}</div>
            </div>
          )
        })}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-accent-soft/40 p-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-accent" />
          <p className="font-bold text-foreground">No products yet</p>
          <p className="mt-1 text-xs text-muted">
            Go to Products tab to add your first product
          </p>
        </div>
      ) : null}

      {outOfStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-danger">
            Out of Stock
          </p>
          {outOfStock.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground">{p.name}</div>
                <div className="text-xs font-semibold text-danger">
                  Stock: 0 · {p.product_code}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {lowStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-warning">
            Low Stock
          </p>
          {lowStock.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="text-sm font-bold text-foreground">{p.name}</div>
              <div className="text-xs font-semibold text-warning">
                Stock: {p.current_quantity}
              </div>
              <StockBar stock={p.current_quantity} />
            </div>
          ))}
        </div>
      ) : null}

      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <button
          type="button"
          onClick={onGoAlerts}
          className="w-full rounded-2xl border-2 border-accent py-3 text-sm font-bold text-accent transition-colors hover:bg-accent-soft/30"
        >
          View All Alerts
        </button>
      )}
    </div>
  )
}

function InventoryAlerts({ products }: { products: Product[] }) {
  const outOfStock = products.filter((p) => p.current_quantity === 0)
  const lowStock = products.filter(
    (p) => p.current_quantity > 0 && getStockLevel(p.current_quantity) === 'low',
  )

  if (outOfStock.length === 0 && lowStock.length === 0) {
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
      {outOfStock.length > 0 ? (
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

      {lowStock.length > 0 ? (
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
              <StockBar stock={p.current_quantity} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function InventoryPage() {
  const { permissions } = useAuth()
  const [tab, setTab] = useState<InvTab>('dashboard')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim())

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(deferredSearch),
    queryFn: () => getProducts(deferredSearch),
  })

  const summaryQuery = useQuery({
    queryKey: queryKeys.inventory.summary,
    queryFn: getInventorySummary,
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

  const alertCount =
    (summaryQuery.data?.low_stock ?? 0) +
    (summaryQuery.data?.out_of_stock ?? 0)

  return (
    <div className="flex min-h-dvh flex-col">
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
        ) : (
          <p className="text-sm text-muted">Manage your stock</p>
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
        onChange={(id) => setTab(id as InvTab)}
      />

      {tab === 'dashboard' ? (
        <InventoryDashboard
          products={products}
          onGoAlerts={() => setTab('alerts')}
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

      {tab === 'alerts' ? <InventoryAlerts products={products} /> : null}
    </div>
  )
}
