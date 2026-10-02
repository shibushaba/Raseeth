import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { PortalBackBar } from '@/components/ui/portal-field'
import { getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useShopScope } from '@/features/shop/useShopScope'
import { formatMoney, parseMoney } from '@/lib/money'

function formatStockValue(totalValue: number): string {
  if (totalValue >= 100000) return `₹${(totalValue / 100000).toFixed(2)}L`
  if (totalValue >= 1000) return `₹${(totalValue / 1000).toFixed(1)}k`
  return formatMoney(totalValue)
}

export function InventoryValuePage() {
  const navigate = useNavigate()
  const { productShopScope, productScopeKey } = useShopScope()
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list('', productScopeKey),
    queryFn: () => getProducts(undefined, productShopScope),
  })

  const products = productsQuery.data ?? []
  const totalValue = products.reduce(
    (s, p) => s + parseMoney(p.avg_unit_cost) * p.current_quantity,
    0,
  )

  const byCategory = new Map<string, { value: number; units: number; count: number }>()
  for (const p of products) {
    const cat = p.category?.trim() || 'Uncategorized'
    const row = byCategory.get(cat) ?? { value: 0, units: 0, count: 0 }
    row.value += parseMoney(p.avg_unit_cost) * p.current_quantity
    row.units += p.current_quantity
    row.count += 1
    byCategory.set(cat, row)
  }

  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1].value - a[1].value)

  const byProduct = [...products]
    .map((p) => ({
      ...p,
      lineValue: parseMoney(p.avg_unit_cost) * p.current_quantity,
    }))
    .filter((p) => p.lineValue > 0 || p.current_quantity > 0)
    .sort((a, b) => b.lineValue - a.lineValue)

  return (
    <div className="flex min-h-dvh flex-col">
      <PortalBackBar title="Inventory value" onBack={() => navigate('/inventory')} />

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">
            Total value (WAC)
          </p>
          <p className="mt-1 text-4xl font-black tabular-nums">
            {formatStockValue(totalValue)}
          </p>
          <p className="mt-2 text-sm font-medium opacity-90">
            {formatMoney(totalValue)} at weighted average cost
          </p>
        </div>

        {categoryRows.length > 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-extrabold text-foreground">By category</h2>
            <ul className="mt-3 space-y-2">
              {categoryRows.map(([name, row]) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{name}</p>
                    <p className="text-[11px] text-muted">
                      {row.count} products · {row.units} units
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-emerald-600">
                    {formatMoney(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-foreground">By product</h2>
          <p className="mt-0.5 text-xs text-muted">Quantity × average unit cost</p>
          {productsQuery.isLoading ? (
            <div className="mt-3 h-24 animate-pulse rounded-xl bg-accent-soft" />
          ) : byProduct.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No stocked products yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {byProduct.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/inventory/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-muted">
                        {p.current_quantity} × {formatMoney(p.avg_unit_cost)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm font-extrabold text-emerald-600">
                        {formatMoney(p.lineValue)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
