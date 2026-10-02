import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Layers } from 'lucide-react'

import { PortalBackBar } from '@/components/ui/portal-field'
import { getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useShopScope } from '@/features/shop/useShopScope'

export function InventoryStockPage() {
  const navigate = useNavigate()
  const { productShopScope, productScopeKey } = useShopScope()
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list('', productScopeKey),
    queryFn: () => getProducts(undefined, productShopScope),
  })

  const products = [...(productsQuery.data ?? [])].sort(
    (a, b) => b.current_quantity - a.current_quantity,
  )
  const totalUnits = products.reduce((s, p) => s + p.current_quantity, 0)

  return (
    <div className="flex min-h-dvh flex-col">
      <PortalBackBar title="Units on hand" onBack={() => navigate('/inventory')} />

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border bg-emerald-50 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Layers className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-3xl font-black tabular-nums text-foreground">
                {totalUnits.toLocaleString('en-IN')}
              </p>
              <p className="text-sm font-semibold text-muted">Total units across {products.length} SKUs</p>
            </div>
          </div>
        </div>

        {productsQuery.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-accent-soft" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/inventory/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 active:bg-accent-soft/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted">{p.product_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tabular-nums text-foreground">
                      {p.current_quantity}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
