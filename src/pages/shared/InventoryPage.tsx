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

import { PortalHeader } from '@/components/layout/portal/PortalHeader'
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
    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
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
    {
      label: 'Total Products',
      value: products.length,
      color: 'bg-violet-600',
      icon: Package,
    },
    {
      label: 'Stock Value',
      value: valueLabel,
      color: 'bg-emerald-500',
      icon: Wallet,
    },
    {
      label: 'Low Stock',
      value: lowStock.length,
      color: 'bg-amber-400',
      icon: AlertTriangle,
    },
    {
      label: 'Out of Stock',
      value: outOfStock.length,
      color: 'bg-red-500',
      icon: Ban,
    },
  ]

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`${card.color} rounded-2xl p-4 text-white`}
            >
              <Icon className="mb-2 h-6 w-6 opacity-90" aria-hidden />
              <div className="text-2xl font-black">{card.value}</div>
              <div className="mt-0.5 text-xs font-semibold opacity-80">
                {card.label}
              </div>
            </div>
          )
        })}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-6 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-violet-400" />
          <p className="font-bold text-gray-600">No products yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Go to Products tab to add your first product
          </p>
        </div>
      ) : null}

      {outOfStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-red-600">
            Out of Stock
          </p>
          {outOfStock.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-800">{p.name}</div>
                <div className="text-xs font-semibold text-red-500">
                  Stock: 0 · {p.product_code}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {lowStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-amber-600">
            Low Stock
          </p>
          {lowStock.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="text-sm font-bold text-gray-800">{p.name}</div>
              <div className="text-xs font-semibold text-amber-600">
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
          className="w-full rounded-2xl border-2 border-emerald-500 py-3 text-sm font-bold text-emerald-700"
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
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-gray-400">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Package className="h-6 w-6" />
        </div>
        <p className="font-bold text-gray-600">All stock levels look good</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      {outOfStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-red-600">
            Out of Stock
          </p>
          {outOfStock.map((p) => (
            <Link
              key={p.id}
              to={`/inventory/${p.id}`}
              className="mb-2 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3"
            >
              <div>
                <div className="text-sm font-bold text-gray-800">{p.name}</div>
                <div className="text-xs font-semibold text-red-500">
                  Stock: 0
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700">
                Restock <ArrowRight className="inline h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {lowStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-amber-600">
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
                  <div className="text-sm font-bold text-gray-800">{p.name}</div>
                  <div className="text-xs font-semibold text-amber-600">
                    Stock: {p.current_quantity}
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700">
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
  const { permissions, profile, signOut } = useAuth()
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

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Manager'

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <PortalHeader
        tone="emerald"
        subtitle="Inventory"
        title={`Hi, ${firstName}`}
        onLogout={() => void signOut()}
        search={tab === 'products' ? search : undefined}
        onSearchChange={tab === 'products' ? setSearch : undefined}
        searchPlaceholder="Search products…"
      />

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
            <div className="flex gap-2 overflow-x-auto border-b border-emerald-50 bg-white px-4 py-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat === 'All' ? null : cat)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    (cat === 'All' && !category) || category === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700'
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
                    className="h-16 animate-pulse rounded-2xl bg-emerald-50"
                  />
                ))}
              </div>
            ) : errorMessage ? (
              <p className="p-4 text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : (
              <InventoryProductList products={filteredProducts} />
            )}
          </div>

          {permissions.canCreateProduct ? (
            <div className="relative border-t border-emerald-100 bg-white p-3">
              <div
                className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white to-transparent"
                aria-hidden
              />
              <Link
                to="/inventory/new"
                className="block w-full rounded-2xl bg-emerald-600 py-4 text-center text-sm font-extrabold text-white shadow-lg active:bg-emerald-700"
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
